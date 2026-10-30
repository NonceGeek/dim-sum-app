export const feedbackTypes = [
  "content_error",
  "audio_issue",
  "suggestion",
  "other",
] as const;
export const feedbackStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "DISMISSED",
] as const;
