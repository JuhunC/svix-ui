import crypto from "node:crypto";

/** Constant-time string comparison that does not throw on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export interface OperatorCredentials {
  operatorUsername: string;
  operatorPassword: string;
}

export function verifyOperatorCredentials(
  username: string,
  password: string,
  cfg: OperatorCredentials,
): boolean {
  // Evaluate both comparisons to avoid short-circuit timing leaks.
  const userOk = safeEqual(username, cfg.operatorUsername);
  const passOk = safeEqual(password, cfg.operatorPassword);
  return userOk && passOk;
}
