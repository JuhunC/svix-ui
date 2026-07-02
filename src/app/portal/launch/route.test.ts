// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import {
  ADMIN_ENV,
  applyAdminEnv,
  clearAdminEnv,
} from "../../../../tests/helpers/admin-route";
import { openPortalSession } from "@/lib/auth/portal";

afterEach(() => clearAdminEnv());

describe("GET /portal/launch", () => {
  it("seals the token into a cookie and redirects relatively to /portal", async () => {
    applyAdminEnv();
    const res = await GET(
      new NextRequest(
        "http://0.0.0.0:3000/portal/launch?token=sk_app&app=app_9&exp=3600",
      ),
    );
    expect(res.status).toBe(307);
    // Relative location → browser resolves it against the address-bar origin,
    // never the internal bind host.
    expect(res.headers.get("location")).toBe("/portal");

    const cookie = res.cookies.get("svix_ui_portal");
    expect(cookie?.value).toBeTruthy();
    const opened = openPortalSession(cookie!.value, ADMIN_ENV.SVIX_UI_SESSION_SECRET);
    expect(opened?.token).toBe("sk_app");
    expect(opened?.appId).toBe("app_9");
  });

  it("redirects to /portal/expired when the token is missing", async () => {
    applyAdminEnv();
    const res = await GET(new NextRequest("http://localhost/portal/launch?app=app_9"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/portal/expired");
  });

  it("deep-links to a safe portal target via `to`", async () => {
    applyAdminEnv();
    const res = await GET(
      new NextRequest(
        "http://0.0.0.0:3000/portal/launch?token=sk&app=app_9&exp=3600&to=%2Fportal%2Fendpoints%2Fep_1",
      ),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/portal/endpoints/ep_1");
  });

  it("ignores an unsafe `to` (open-redirect guard)", async () => {
    applyAdminEnv();
    const res = await GET(
      new NextRequest(
        "http://0.0.0.0:3000/portal/launch?token=sk&app=app_9&exp=3600&to=%2F%2Fevil.com",
      ),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/portal");
  });
});
