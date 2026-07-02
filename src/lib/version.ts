import pkg from "../../package.json";

/**
 * App version + build commit, for display in the dashboard.
 *
 * `version` is inlined from package.json at build time. `commit` comes from the
 * SVIX_UI_GIT_SHA env var, which the image build bakes in (CI passes the commit
 * sha as a build arg); it is empty for local/dev runs.
 */
export function getAppVersion(): {
  version: string;
  commit: string;
  label: string;
} {
  const version = (pkg as { version: string }).version;
  const commit = (process.env.SVIX_UI_GIT_SHA ?? "").trim().slice(0, 7);
  return {
    version,
    commit,
    label: commit ? `v${version} · ${commit}` : `v${version}`,
  };
}
