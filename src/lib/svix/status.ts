import type { MessageAttempt } from "./types";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

/** Maps Svix's numeric attempt status to a label + UI tone. */
export function attemptStatus(status: number): { label: string; tone: StatusTone } {
  switch (status) {
    case 0:
      return { label: "Succeeded", tone: "success" };
    case 1:
      return { label: "Pending", tone: "warning" };
    case 2:
      return { label: "Failed", tone: "danger" };
    case 3:
      return { label: "Sending", tone: "info" };
    default:
      return { label: "Unknown", tone: "neutral" };
  }
}

export function isFailed(attempt: Pick<MessageAttempt, "status">): boolean {
  return attempt.status === 2;
}
