import { afterAll, describe, expect, it } from "vitest";
import { SvixClient } from "@/lib/svix/client";

/**
 * End-to-end checks against a real svix-server. Runs only when both env vars
 * are set (the CI `integration` job and the local docker-compose stack provide
 * them); otherwise the suite is skipped so the unit run stays hermetic.
 */
const serverUrl = process.env.SVIX_SERVER_URL;
const token = process.env.SVIX_ADMIN_TOKEN;
const suite = serverUrl && token ? describe : describe.skip;

suite("svix-server integration", () => {
  const client = new SvixClient({ serverUrl: serverUrl!, token: token! });
  const stamp = Date.now();
  const eventTypeName = `integration.test.${stamp}`;
  let appId = "";
  let endpointId = "";

  afterAll(async () => {
    if (appId) await client.deleteApplication(appId).catch(() => {});
    await client.deleteEventType(eventTypeName).catch(() => {});
  });

  it("reports a healthy server", async () => {
    const health = await client.health();
    expect(health.ok).toBe(true);
  });

  it("creates an event type", async () => {
    const et = await client.createEventType({
      name: eventTypeName,
      description: "Integration test event",
      schemas: { "1": { type: "object" } },
    });
    expect(et.name).toBe(eventTypeName);
  });

  it("creates an application", async () => {
    const app = await client.createApplication({ name: `integration-${stamp}` });
    appId = app.id;
    expect(appId).toMatch(/^app_/);
  });

  it("creates an endpoint and exposes a whsec_ signing secret", async () => {
    const ep = await client.createEndpoint(appId, {
      url: "https://example.com/svix-integration",
      filterTypes: [eventTypeName],
    });
    endpointId = ep.id;
    const secret = await client.getEndpointSecret(appId, endpointId);
    expect(secret.key).toMatch(/^whsec_/);
  });

  it("rotates the signing secret", async () => {
    await client.rotateEndpointSecret(appId, endpointId);
    const secret = await client.getEndpointSecret(appId, endpointId);
    expect(secret.key).toMatch(/^whsec_/);
  });

  it("sends a message and lists it", async () => {
    await client.createMessage(appId, {
      eventType: eventTypeName,
      payload: { hello: "world", stamp },
    });
    const page = await client.listMessages(appId, { limit: 10 });
    expect(page.data.length).toBeGreaterThan(0);
    expect(page.data[0].eventType).toBe(eventTypeName);
  });

  it("issues an app-portal-access token", async () => {
    const access = await client.appPortalAccess(appId, {
      capabilities: ["ViewBase"],
      readOnly: true,
    });
    expect(access.token).toBeTruthy();
  });

  it("lists endpoints for the application", async () => {
    const page = await client.listEndpoints(appId);
    expect(page.data.some((e) => e.id === endpointId)).toBe(true);
  });
});
