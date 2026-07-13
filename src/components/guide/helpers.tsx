"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { copyToClipboard } from "@/lib/clipboard";

/** Inline code, or a labeled dark block with a copy button. */
export function Code({ children, label }: { children: string; label?: string }) {
  const isBlock = children.includes("\n") || Boolean(label);
  const [copied, setCopied] = useState(false);
  if (!isBlock) {
    return (
      <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.85em] text-zinc-800">
        {children}
      </code>
    );
  }
  return (
    <div className="mt-1">
      {label ? (
        <div className="rounded-t-md border border-b-0 border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-500">
          {label}
        </div>
      ) : null}
      <div className="relative">
        <button
          type="button"
          onClick={async () => setCopied(await copyToClipboard(children))}
          className="absolute right-2 top-2 z-10 rounded bg-white/10 px-2 py-0.5 text-xs text-zinc-300 hover:bg-white/20"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <pre
          className={`overflow-x-auto ${label ? "rounded-b-md" : "rounded-md"} bg-zinc-900 p-4 font-mono text-xs leading-relaxed text-zinc-100`}
        >
          {children}
        </pre>
      </div>
    </div>
  );
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-accent hover:underline"
    >
      {children}
      <Icon name="externalLink" size={13} />
    </a>
  );
}

/** Anchor-linkable guide section. */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-zinc-700">{children}</div>
    </section>
  );
}
