"use client";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { AlertCircle, Loader2, Search, X, ChevronDown } from "lucide-react";

// Button
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}
export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  children,
  icon,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed select-none shrink-0",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-9 px-4 text-sm",
        size === "lg" && "h-11 px-6 text-base",
        variant === "primary" &&
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm active:scale-[0.98]",
        variant === "secondary" &&
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "ghost" && "hover:bg-secondary text-foreground",
        variant === "outline" &&
          "border border-border bg-transparent hover:bg-secondary text-foreground",
        variant === "danger" &&
          "bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border border-destructive/20",
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

//  Input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, leftIcon, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "w-full h-9 rounded-xl border bg-background text-sm transition-all",
              "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
              "placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed",
              leftIcon ? "pl-9 pr-3" : "px-3",
              error
                ? "border-destructive focus:ring-destructive/30"
                : "border-input",
              className,
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="text-xs text-muted-foreground">{helperText}</p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

//  Textarea
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          className={cn(
            "w-full min-h-[80px] px-3 py-2 rounded-xl border bg-background text-sm transition-all resize-none",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
            "placeholder:text-muted-foreground",
            error ? "border-destructive" : "border-input",
            className,
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {error}
          </p>
        )}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

// Select
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={cn(
            "w-full h-9 px-3 rounded-xl border bg-background text-sm transition-all appearance-none",
            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
            error ? "border-destructive" : "border-input",
            className,
          )}
          {...props}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  },
);
Select.displayName = "Select";

//  Card
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  padding?: boolean;
}
export function Card({
  className,
  hover,
  padding = true,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-2xl",
        padding && "p-4",
        hover && "card-hover cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

//  Badge
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "violet";
}
export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border",
        variant === "default" &&
          "bg-secondary text-secondary-foreground border-border",
        variant === "success" &&
          "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
        variant === "warning" &&
          "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
        variant === "danger" &&
          "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
        variant === "info" && "bg-primary/10 text-primary border-primary/20",
        variant === "violet" &&
          "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

//  Skeleton
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

//  LoadingSpinner
export function LoadingSpinner({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <Loader2
      className={cn(
        "animate-spin text-primary",
        size === "sm" && "w-4 h-4",
        size === "md" && "w-6 h-6",
        size === "lg" && "w-8 h-8",
        className,
      )}
    />
  );
}

//  PageLoader
export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
    </div>
  );
}

//  ErrorMessage
export function ErrorMessage({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[20vh] gap-3 text-center p-6">
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-destructive" />
      </div>
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

//  EmptyState
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
    <div className="flex flex-col items-center justify-center min-h-[20vh] gap-2 text-center p-6">
      {icon && <div className="text-muted-foreground/40 mb-1">{icon}</div>}
      <p className="font-semibold text-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

//  KpiCard
export function KpiCard({
  label,
  value,
  sub,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  highlight?: string;
}) {
  return (
    <Card
      className={cn(
        "flex flex-col gap-1",
        highlight && `border-l-4 border-l-[${highlight}]`,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          {label}
        </p>
        {icon && <span className="text-muted-foreground/50">{icon}</span>}
      </div>
      <p className="text-xl font-bold font-display">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

//  Modal
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative bg-card border border-border rounded-2xl shadow-2xl w-full animate-scale-in overflow-hidden",
          "max-h-[90vh] flex flex-col",
          size === "sm" && "max-w-sm",
          size === "md" && "max-w-lg",
          size === "lg" && "max-w-2xl",
          size === "xl" && "max-w-4xl",
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h2 className="font-semibold text-base">{title}</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

//  Tabs
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-secondary rounded-xl w-fit">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
            active === t.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={cn(
                "ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold",
                active === t.id
                  ? "bg-primary/10 text-primary"
                  : "bg-muted-foreground/20",
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

//  SearchDropdown (player search within squad)
interface PlayerOption {
  id: number;
  name: string;
  position?: string;
  photo_url?: string;
}
export function PlayerSearchDropdown({
  players,
  onSelect,
  placeholder = "Search players...",
}: {
  players: PlayerOption[];
  onSelect: (p: PlayerOption) => void;
  placeholder?: string;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const filtered =
    q.length > 0
      ? players
          .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
          .slice(0, 10)
      : players.slice(0, 8);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full h-9 pl-9 pr-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-scale-in">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary transition-colors text-left"
              onClick={() => {
                onSelect(p);
                setQ(p.name);
                setOpen(false);
              }}
            >
              {p.photo_url ? (
                <img
                  src={p.photo_url}
                  alt={p.name}
                  className="w-7 h-7 rounded-full object-cover bg-muted"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {p.name[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                {p.position && (
                  <p className="text-xs text-muted-foreground">{p.position}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ClubSearchDropdown
export function ClubSearchInput({
  label,
  value,
  onChange,
  placeholder = "Search clubs...",
}: {
  label?: string;
  value: string;
  onChange: (clubId: number, clubName: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = React.useState(value || "");
  const [results, setResults] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const timer = React.useRef<any>(null);

  React.useEffect(() => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { searchApi } = await import("@/lib/api/client");
        const res = await searchApi.clubs(q);
        setResults(res);
      } catch {
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer.current);
  }, [q]);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="space-y-1.5" ref={ref}>
      {label && (
        <label className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full h-9 pl-9 pr-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-scale-in w-80">
          {results.slice(0, 8).map((c: any) => (
            <button
              key={c.api_football_id}
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary transition-colors text-left"
              onClick={() => {
                onChange(c.api_football_id, c.name);
                setQ(c.name);
                setOpen(false);
              }}
            >
              {c.logo_url && (
                <img
                  src={c.logo_url}
                  alt={c.name}
                  className="w-6 h-6 object-contain"
                />
              )}
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.country} · {c.league}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

//  FFP Status Badge
export function FFPBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  return (
    <Badge
      variant={
        s === "compliant"
          ? "success"
          : s === "warning"
            ? "warning"
            : s === "breach"
              ? "danger"
              : "default"
      }
    >
      {status || "—"}
    </Badge>
  );
}

//  Position badge
export function PositionBadge({ position }: { position?: string }) {
  const p = position?.toUpperCase() ?? "?";
  const color = p.startsWith("G")
    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
    : p.startsWith("D")
      ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
      : p.startsWith("M")
        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
        : "bg-red-500/10 text-red-600 border-red-500/20";
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold border",
        color,
      )}
    >
      {p.slice(0, 3)}
    </span>
  );
}
