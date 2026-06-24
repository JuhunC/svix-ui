import { describe, it, expect } from "vitest";
import { APP_NAME, APP_DESCRIPTION, DEFAULT_SVIX_SERVER_URL } from "./app";

describe("app metadata", () => {
  it("exposes the project name", () => {
    expect(APP_NAME).toBe("svix-ui");
  });

  it("describes the project", () => {
    expect(APP_DESCRIPTION).toContain("Svix");
  });

  it("defaults the svix-server url to the docker-compose port", () => {
    expect(DEFAULT_SVIX_SERVER_URL).toBe("http://localhost:8071");
  });
});
