import assert from "node:assert/strict";
import test from "node:test";
import { mediaErrorType, playRejectionType, VideoLoadTracker, videoIdFromUrl } from "./video-tracker";

function setup() {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, () => void>();
  const events: Array<{ name: string; props: Record<string, unknown> }> = [];
  const tracker = new VideoLoadTracker(
    { entryId: "e1", videoId: "/v.mp4", surface: "search_tile", fallbackType: "text_audio", query: "食饭", section: "similar" },
    (name, props) => events.push({ name, props }),
    {
      now: () => now,
      uuid: () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
      setTimeout: (fn) => {
        const id = ++seq;
        timers.set(id, fn);
        return id;
      },
      clearTimeout: (id) => timers.delete(id as number),
    },
  );
  return {
    tracker,
    events,
    advance(ms: number) {
      now += ms;
      if (now >= 15_000) for (const [id, fn] of [...timers]) { timers.delete(id); fn(); }
    },
  };
}

test("video_play only on actual playback, once per session", () => {
  const { tracker, events } = setup();
  tracker.startAttempt();
  assert.equal(events.length, 0, "pressing play is not playing");
  tracker.playing();
  tracker.cancel(); // pause
  tracker.startAttempt(); // resume
  tracker.playing();
  assert.deepEqual(events.map((e) => e.name), ["video_play"]);
  assert.equal(events[0].props.query, "食饭");
  assert.equal(events[0].props.section, "similar");
  assert.equal(events[0].props.playSessionId, tracker.playSessionId);
});

test("error and timeout in the same attempt count once; retry is a new attempt", () => {
  const { tracker, events, advance } = setup();
  tracker.startAttempt();
  advance(3_000);
  tracker.fail("network");
  advance(20_000); // timeout timer was cleared
  assert.equal(events.length, 1);
  assert.equal(events[0].props.errorType, "network");
  assert.equal(events[0].props.loadElapsedMs, 3_000);
  assert.equal(events[0].props.fallbackType, "text_audio");
  tracker.startAttempt(); // user retry
  tracker.fail("resource_unavailable");
  assert.equal(events.length, 2);
  assert.notEqual(events[0].props.loadAttemptId, events[1].props.loadAttemptId);
  assert.equal(events[0].props.playSessionId, events[1].props.playSessionId);
});

test("timeout after 15s; closing or leaving is not a failure", () => {
  const timedOut = setup();
  timedOut.tracker.startAttempt();
  timedOut.advance(15_000);
  assert.equal(timedOut.events[0].props.errorType, "timeout");
  assert.equal(timedOut.events[0].props.loadElapsedMs, 15_000);

  const closed = setup();
  closed.tracker.startAttempt();
  closed.advance(5_000);
  closed.tracker.cancel();
  closed.advance(20_000);
  closed.tracker.fail("unknown"); // error raised while tearing down
  assert.equal(closed.events.length, 0);
});

test("errors without a play attempt or after playback are ignored", () => {
  const { tracker, events } = setup();
  tracker.fail("network"); // preview metadata failed before any play intent
  tracker.startAttempt();
  tracker.playing();
  tracker.fail("network");
  assert.deepEqual(events.map((e) => e.name), ["video_play"]);
});

test("error type mapping and video id", () => {
  assert.equal(mediaErrorType(1), null);
  assert.equal(mediaErrorType(2), "network");
  assert.equal(mediaErrorType(4), "resource_unavailable");
  assert.equal(playRejectionType(new DOMException("x", "AbortError")), null);
  assert.equal(playRejectionType(new DOMException("x", "NotSupportedError")), "unsupported");
  assert.equal(videoIdFromUrl("https://oss.example.com/a/b.mp4?Signature=secret"), "/a/b.mp4");
});
