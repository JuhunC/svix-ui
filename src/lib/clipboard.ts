/**
 * Copy text to the clipboard, working in both secure and non-secure contexts.
 *
 * `navigator.clipboard` is only exposed on secure origins (HTTPS or localhost).
 * svix-ui is frequently reached over plain HTTP (e.g. http://<private-ip>:4000),
 * where `navigator.clipboard` is `undefined` and the modern API throws. In that
 * case we fall back to the legacy `document.execCommand("copy")` path via a
 * temporary off-screen <textarea>.
 *
 * Returns whether the copy succeeded.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof window !== "undefined" &&
    window.isSecureContext
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path below.
    }
  }

  if (typeof document === "undefined") return false;
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
