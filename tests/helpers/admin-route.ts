import { setupServer } from "msw/node";
import { createOperatorSession } from "@/lib/auth/session";
import { resetConfigCache } from "@/lib/config";

/** Shared env + MSW upstream for admin BFF route tests. */
export const ADMIN_ENV = {
  SVIX_SERVER_URL: "http://svix.test",
  SVIX_ADMIN_TOKEN: "admintok",
  SVIX_UI_SESSION_SECRET: "test-session-secret-1234567890",
  SVIX_UI_OPERATOR_USERNAME: "admin",
  SVIX_UI_OPERATOR_PASSWORD: "pw",
};

export function applyAdminEnv() {
  Object.assign(process.env, ADMIN_ENV);
  resetConfigCache();
}

export function clearAdminEnv() {
  for (const key of Object.keys(ADMIN_ENV)) delete process.env[key];
  resetConfigCache();
}

export function validOperatorToken() {
  return createOperatorSession("admin", ADMIN_ENV.SVIX_UI_SESSION_SECRET);
}

/** A fresh MSW server per importing test module. */
export const svixServer = setupServer();
