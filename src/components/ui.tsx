import * as React from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";

/** Tiny className combiner (avoids a clsx dependency). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** One focus treatment for every interactive primitive. */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus focus-visible:ring-offset-1";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  const base = cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
    FOCUS_RING,
  );
  const sizes = { sm: "h-8 px-3 text-sm", md: "h-9 px-4 text-sm" };
  const variants = {
    primary: "bg-accent text-white shadow-sm hover:bg-accent-hover",
    secondary: "border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50",
    danger: "bg-red-600 text-white shadow-sm hover:bg-red-500",
    ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  };
  return (
    <button
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    />
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400",
        FOCUS_RING,
        className,
      )}
      {...props}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: "sm" | "md" }
>(function Select({ className, size = "md", ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        size === "sm" ? "h-8 px-2" : "h-9 px-3",
        "rounded-md border border-zinc-300 bg-white text-sm text-zinc-900",
        FOCUS_RING,
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 placeholder:text-zinc-400",
        FOCUS_RING,
        className,
      )}
      {...props}
    />
  );
});

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1 block text-sm font-medium text-zinc-700", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-200 bg-white shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: "neutral" | "success" | "danger" | "warning" | "info";
  /** Show a colored status dot (Stripe/Convoy-style delivery-state pill). */
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-zinc-100 text-zinc-700",
    success: "bg-green-100 text-green-800",
    danger: "bg-red-100 text-red-800",
    warning: "bg-amber-100 text-amber-800",
    info: "bg-blue-100 text-blue-800",
  };
  const dots = {
    neutral: "bg-zinc-400",
    success: "bg-green-500",
    danger: "bg-red-500",
    warning: "bg-amber-500",
    info: "bg-blue-500",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {dot ? (
        <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dots[tone])} />
      ) : null}
      {children}
    </span>
  );
}

export function Alert({
  tone = "danger",
  children,
}: {
  tone?: "danger" | "info" | "success";
  children: React.ReactNode;
}) {
  const tones = {
    danger: "border-red-200 bg-red-50 text-red-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
    success: "border-green-200 bg-green-50 text-green-800",
  };
  // Announce to assistive tech: errors assertively, info/success politely.
  const live = tone === "danger" ? "assertive" : "polite";
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      aria-live={live}
      className={cn("rounded-md border px-3 py-2 text-sm", tones[tone])}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50/60 px-6 py-14 text-center">
      {icon ? (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-400 shadow-sm ring-1 ring-zinc-200">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-zinc-900">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-zinc-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export interface TabItem {
  key: string;
  label: React.ReactNode;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="border-b border-zinc-200">
      <nav role="tablist" className="-mb-px flex gap-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => onChange(t.key)}
            className={cn(
              "whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium transition-colors",
              FOCUS_RING,
              active === t.key
                ? "border-accent text-zinc-900"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-accent",
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

/** Standard first-load affordance: a centered spinner block. */
export function LoadingState({ className }: { className?: string }) {
  return (
    <div className={cn("flex justify-center py-10", className)}>
      <Spinner className="h-5 w-5" />
    </div>
  );
}

/** Standard back-navigation link for detail pages. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1 rounded text-sm text-zinc-500 hover:text-zinc-900",
        FOCUS_RING,
      )}
    >
      <Icon name="chevronLeft" size={14} /> {children}
    </Link>
  );
}

/** Card section heading: icon + title with optional action buttons. */
export function CardHeading({
  icon,
  title,
  children,
}: {
  icon?: IconName;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
        {icon ? <Icon name={icon} size={17} className="text-zinc-400" /> : null}
        {title}
      </h2>
      {children ? <div className="flex gap-2">{children}</div> : null}
    </div>
  );
}

/** Label/value pair for metadata grids (dt/dd). */
export function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-zinc-800">{value}</dd>
    </div>
  );
}

/** Announced "Saved" confirmation next to a save button. */
export function SavedIndicator({ show }: { show: boolean }) {
  return (
    <span role="status" aria-live="polite" className="text-xs text-green-600">
      {show ? "Saved" : ""}
    </span>
  );
}
