import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { copyToClipboard } from "./clipboard";

// jsdom doesn't implement document.execCommand, so define a mock we control.
let execCommand: ReturnType<typeof vi.fn>;

beforeEach(() => {
  execCommand = vi.fn().mockReturnValue(true);
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    writable: true,
    value: execCommand,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete (document as { execCommand?: unknown }).execCommand;
});

describe("copyToClipboard", () => {
  it("uses the async clipboard API in a secure context", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const ok = await copyToClipboard("hello");

    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("falls back to execCommand in a non-secure (plain HTTP) context", async () => {
    // navigator.clipboard is undefined over http://<ip>:port — the original bug.
    vi.stubGlobal("isSecureContext", false);
    vi.stubGlobal("navigator", {});

    const ok = await copyToClipboard("hello");

    expect(ok).toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("falls back when the clipboard API throws", async () => {
    vi.stubGlobal("isSecureContext", true);
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });

    const ok = await copyToClipboard("hello");

    expect(ok).toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("returns false when the fallback copy fails", async () => {
    vi.stubGlobal("isSecureContext", false);
    vi.stubGlobal("navigator", {});
    execCommand.mockReturnValue(false);

    expect(await copyToClipboard("hello")).toBe(false);
  });
});
