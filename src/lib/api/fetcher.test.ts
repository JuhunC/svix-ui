import { describe, it, expect, vi, afterEach } from "vitest";
import { ApiError, apiGet, apiSend } from "./fetcher";

const realLocation = window.location;

function mockLocation(pathname: string) {
  const assign = vi.fn();
  Object.defineProperty(window, "location", {
    value: { pathname, assign },
    configurable: true,
    writable: true,
  });
  return assign;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(window, "location", {
    value: realLocation,
    configurable: true,
    writable: true,
  });
});

describe("fetcher", () => {
  it("returns parsed JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: 1 }), { status: 200 }),
      ),
    );
    expect(await apiGet<{ ok: number }>("/api/x")).toEqual({ ok: 1 });
  });

  it("throws ApiError carrying the server error message on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "nope" }), { status: 400 }),
      ),
    );
    await expect(apiGet("/api/x")).rejects.toMatchObject({
      status: 400,
      message: "nope",
    });
  });

  it("redirects to /login on 401 from a console page", async () => {
    const assign = mockLocation("/console/applications");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 401 })),
    );
    await expect(apiGet("/api/admin/apps")).rejects.toBeInstanceOf(ApiError);
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("redirects to /portal/expired on 401 from a portal page", async () => {
    const assign = mockLocation("/portal/endpoints");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 401 })),
    );
    await expect(apiGet("/api/portal/endpoints")).rejects.toBeInstanceOf(ApiError);
    expect(assign).toHaveBeenCalledWith("/portal/expired");
  });

  it("does not redirect-loop when already on the re-auth page", async () => {
    const assign = mockLocation("/login");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 401 })),
    );
    await expect(apiGet("/api/admin/apps")).rejects.toBeInstanceOf(ApiError);
    expect(assign).not.toHaveBeenCalled();
  });

  it("normalizes a network failure into an actionable ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(apiSend("POST", "/api/x")).rejects.toMatchObject({
      status: 0,
      message: /reach the server/i,
    });
  });

  it("normalizes an abort/timeout into an ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")),
    );
    await expect(apiGet("/api/x")).rejects.toMatchObject({
      status: 0,
      message: /too long/i,
    });
  });
});
