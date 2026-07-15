import { describe, it, expect } from "vitest";
import {
  attemptStatus,
  httpCodeTone,
  isFailed,
  ATTEMPT_STATUSES,
} from "./status";

describe("attemptStatus", () => {
  it("maps each known numeric status to a label and tone", () => {
    expect(attemptStatus(0)).toEqual({ label: "Succeeded", tone: "success" });
    expect(attemptStatus(1)).toEqual({ label: "Pending", tone: "warning" });
    expect(attemptStatus(2)).toEqual({ label: "Failed", tone: "danger" });
    expect(attemptStatus(3)).toEqual({ label: "Sending", tone: "info" });
    expect(attemptStatus(4)).toEqual({ label: "Canceled", tone: "neutral" });
  });

  it("falls back to Unknown/neutral for unrecognized statuses", () => {
    expect(attemptStatus(5)).toEqual({ label: "Unknown", tone: "neutral" });
    expect(attemptStatus(-1)).toEqual({ label: "Unknown", tone: "neutral" });
    expect(attemptStatus(99)).toEqual({ label: "Unknown", tone: "neutral" });
  });
});

describe("httpCodeTone", () => {
  it("treats undefined and 0 as no-response", () => {
    expect(httpCodeTone(undefined)).toBe("text-zinc-400");
    expect(httpCodeTone(0)).toBe("text-zinc-400");
  });

  it("colors sub-300 codes green (boundaries 199/200/299)", () => {
    expect(httpCodeTone(199)).toBe("text-green-700");
    expect(httpCodeTone(200)).toBe("text-green-700");
    expect(httpCodeTone(299)).toBe("text-green-700");
  });

  it("colors 3xx codes zinc (boundaries 300/399)", () => {
    expect(httpCodeTone(300)).toBe("text-zinc-500");
    expect(httpCodeTone(399)).toBe("text-zinc-500");
  });

  it("colors 4xx codes amber (boundaries 400/499)", () => {
    expect(httpCodeTone(400)).toBe("text-amber-700");
    expect(httpCodeTone(499)).toBe("text-amber-700");
  });

  it("colors 5xx codes red (boundary 500)", () => {
    expect(httpCodeTone(500)).toBe("text-red-700");
    expect(httpCodeTone(599)).toBe("text-red-700");
  });
});

describe("isFailed", () => {
  it("is true only for status 2", () => {
    expect(isFailed({ status: 2 })).toBe(true);
  });

  it("is false for every other status", () => {
    expect(isFailed({ status: 0 })).toBe(false);
    expect(isFailed({ status: 1 })).toBe(false);
    expect(isFailed({ status: 3 })).toBe(false);
    expect(isFailed({ status: 4 })).toBe(false);
  });
});

describe("ATTEMPT_STATUSES", () => {
  it("lists the filterable statuses as value/label pairs", () => {
    expect(ATTEMPT_STATUSES).toEqual([
      { value: 0, label: "Succeeded" },
      { value: 2, label: "Failed" },
      { value: 1, label: "Pending" },
      { value: 3, label: "Sending" },
    ]);
  });

  it("labels agree with attemptStatus for each listed value", () => {
    for (const { value, label } of ATTEMPT_STATUSES) {
      expect(attemptStatus(value).label).toBe(label);
    }
  });
});
