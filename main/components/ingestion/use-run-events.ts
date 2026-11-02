"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentClient } from "./agent-client";
import type { RunView } from "./types";

const RECONNECT_MS = 3000;

/**
 * 订阅 Agent 的 run 状态推送；标签页不可见时断开，可见时重连并先收到全量状态。
 * EventSource 不能带 Authorization 头，这里用 fetch 读 SSE 流。
 */
export function useRunEvents(client: AgentClient, enabled: boolean, onRun: (run: RunView) => void) {
  const [error, setError] = useState(false);
  const onRunRef = useRef(onRun);
  useEffect(() => {
    onRunRef.current = onRun;
  });

  useEffect(() => {
    if (!enabled) return;
    let controller: AbortController | undefined;
    let retry: number | undefined;
    const disconnect = () => {
      window.clearTimeout(retry);
      controller?.abort();
      controller = undefined;
    };
    const connect = () => {
      disconnect();
      if (document.visibilityState !== "visible") return;
      const current = new AbortController();
      controller = current;
      void stream(client, current.signal, (run) => {
        setError(false);
        onRunRef.current(run);
      }).catch(() => {
        if (current.signal.aborted) return;
        setError(true);
        retry = window.setTimeout(connect, RECONNECT_MS);
      });
    };
    connect();
    document.addEventListener("visibilitychange", connect);
    return () => {
      document.removeEventListener("visibilitychange", connect);
      disconnect();
    };
  }, [client, enabled]);

  return error;
}

async function stream(client: AgentClient, signal: AbortSignal, onRun: (run: RunView) => void) {
  const { url, headers } = await client.prepare("/events");
  const response = await fetch(url, { headers, signal });
  if (!response.ok || !response.body) throw new Error(`events: ${response.status}`);
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) throw new Error("events: closed");
    buffer += value;
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const lines = frame.split("\n");
      const event = lines.find((line) => line.startsWith("event:"))?.slice(6);
      const data = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).replace(/^ /, ""))
        .join("\n");
      if (event?.trim() === "run" && data) onRun(JSON.parse(data) as RunView);
    }
  }
}
