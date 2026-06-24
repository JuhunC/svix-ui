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
  it("seals the token into a cookie and redirects to /portal", async () => {
    applyAdminEnv();
    const res = await GET(
      new NextRequest(
        "http://localhost/portal/launch?token=sk_app&app=app_9&exp=3600",
      ),
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/portal");

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
    expect(res.headers.get("location")).toContain("/portal/expired");
  });
});
