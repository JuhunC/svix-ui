import { describe, it, expect } from "vitest";
import { formatDateTime, timeAgo } from "./format";

describe("formatDateTime", () => {
  it("returns an em-dash for missing input", () => {
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("")).toBe("—");
  });

  it("returns an em-dash for an unparseable timestamp", () => {
    expect(formatDateTime("not-a-date")).toBe("—");
  });

  it("formats a valid ISO timestamp into a non-empty, dated string", () => {
    // Midday UTC keeps the calendar year stable across machine timezones.
    const out = formatDateTime("2026-06-15T12:00:00Z");
    expect(out).not.toBe("—");
    expect(out.length).toBeGreaterThan(0);
    expect(out).toContain("2026");
  });
});

describe("timeAgo", () => {
  // Fixed reference point so the relative buckets are fully deterministic.
  const NOW = Date.parse("2026-06-15T12:00:00.000Z");
  const ago = (ms: number) => new Date(NOW - ms).toISOString();

  it("returns an em-dash for missing or unparseable input", () => {
    expect(timeAgo(undefined, NOW)).toBe("—");
    expect(timeAgo(null, NOW)).toBe("—");
    expect(timeAgo("not-a-date", NOW)).toBe("—");
  });

  it("reports seconds for events under a minute old", () => {
    expect(timeAgo(ago(0), NOW)).toBe("0s ago");
    expect(timeAgo(ago(30_000), NOW)).toBe("30s ago");
    expect(timeAgo(ago(59_000), NOW)).toBe("59s ago");
  });

  it("reports minutes for events under an hour old", () => {
    expect(timeAgo(ago(60_000), NOW)).toBe("1m ago");
    expect(timeAgo(ago(5 * 60_000), NOW)).toBe("5m ago");
    expect(timeAgo(ago(59 * 60_000), NOW)).toBe("59m ago");
  });

  it("reports hours for events under a day old", () => {
    expect(timeAgo(ago(60 * 60_000), NOW)).toBe("1h ago");
    expect(timeAgo(ago(3 * 60 * 60_000), NOW)).toBe("3h ago");
    expect(timeAgo(ago(23 * 60 * 60_000), NOW)).toBe("23h ago");
  });

  it("reports days for older events", () => {
    expect(timeAgo(ago(24 * 60 * 60_000), NOW)).toBe("1d ago");
    expect(timeAgo(ago(2 * 24 * 60 * 60_000), NOW)).toBe("2d ago");
    expect(timeAgo(ago(10 * 24 * 60 * 60_000), NOW)).toBe("10d ago");
  });

  it("defaults 'now' to the current time when omitted", () => {
    // Just-created timestamp should read as a small number of seconds.
    expect(timeAgo(new Date().toISOString())).toMatch(/^\d+s ago$/);
  });
});
