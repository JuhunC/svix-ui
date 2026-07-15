import { z } from "zod";
import { SvixClient } from "./svix/client";
import { SvixConfigError } from "./svix/errors";

/**
 * Server-side configuration. Validated lazily (on first use) rather than at
 * import time, so `next build` does not require a populated environment.
 */
const ServerConfigSchema = z.object({
  svixServerUrl: z.string().url(),
  svixAdminToken: z.string().min(1),
  sessionSecret: z.string().min(16, "must be at least 16 characters"),
  operatorUsername: z.string().min(1),
  operatorPassword: z.string().min(1),
  publicUrl: z.string().url().optional(),
  // Public source IP that svix-server's webhook deliveries originate from — the
  // value consumers allow through their firewall. Shown on the Guide page. When
  // svix-server runs in Docker this is the Docker HOST's public IP (containers
  // masquerade to the host), never the container's 172.x address; svix-ui can't
  // detect it from inside a container, so the operator sets it here.
  webhookSourceIp: z.string().optional(),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

let cached: ServerConfig | null = null;

function readEnv(env: NodeJS.ProcessEnv) {
  return {
    svixServerUrl: env.SVIX_SERVER_URL,
    svixAdminToken: env.SVIX_ADMIN_TOKEN,
    sessionSecret: env.SVIX_UI_SESSION_SECRET,
    operatorUsername: env.SVIX_UI_OPERATOR_USERNAME,
    operatorPassword: env.SVIX_UI_OPERATOR_PASSWORD,
    // Treat blank as unset so callers fall back to the request origin (avoids a
    // hard-coded localhost public URL leaking into App Portal links).
    publicUrl: env.SVIX_UI_PUBLIC_URL?.trim() || undefined,
    webhookSourceIp: env.SVIX_UI_WEBHOOK_SOURCE_IP?.trim() || undefined,
  };
}

/**
 * Network values shown on the Guide page so consumers can configure their
 * firewall and receiver. `sourceIp` is the operator-set public IP that webhook
 * deliveries come from; `svixServerAddress` is the host:port svix-ui uses to
 * reach svix-server (internal — for the operator, not the consumer firewall).
 * Tolerant of missing config so the guide always renders.
 */
export function getGuideNetworkInfo(env: NodeJS.ProcessEnv = process.env): {
  svixSourceIp?: string;
  svixServerAddress?: string;
} {
  try {
    const cfg = loadServerConfig(env);
    let svixServerAddress: string | undefined;
    try {
      svixServerAddress = new URL(cfg.svixServerUrl).host;
    } catch {
      // ignore an unparseable URL — just omit the internal address
    }
    return { svixSourceIp: cfg.webhookSourceIp, svixServerAddress };
  } catch {
    return {};
  }
}

export function loadServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  // Only cache for the real process environment so tests can vary inputs.
  if (cached && env === process.env) return cached;

  const parsed = ServerConfigSchema.safeParse(readEnv(env));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new SvixConfigError(`Invalid svix-ui configuration: ${issues}`);
  }

  if (env === process.env) cached = parsed.data;
  return parsed.data;
}

/** Clears the cached config. Intended for tests. */
export function resetConfigCache(): void {
  cached = null;
}

/** Admin client bound to the privileged org token. Server-side only. */
export function getAdminClient(env: NodeJS.ProcessEnv = process.env): SvixClient {
  const cfg = loadServerConfig(env);
  return new SvixClient({
    serverUrl: cfg.svixServerUrl,
    token: cfg.svixAdminToken,
  });
}
