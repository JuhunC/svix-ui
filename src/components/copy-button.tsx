"use client";

import { useEffect, useRef, useState } from "react";
import { FOCUS_RING, cn } from "@/components/ui";
import { Icon } from "@/components/icons";
import { copyToClipboard } from "@/lib/clipboard";

/**
 * Small copy affordance for identifiers/secrets/URLs. Shows a check for a
 * moment after copying; announces the result for assistive tech.
 */
export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    const ok = await copyToClipboard(value);
    setCopied(ok);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      title={label}
      className={cn(
        "inline-flex items-center rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700",
        FOCUS_RING,
        className,
      )}
    >
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
      <Icon name={copied ? "check" : "copy"} size={14} className={copied ? "text-green-600" : undefined} />
    </button>
  );
}
