import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEur(
  value: number | null | undefined,
  compact = false,
): string {
  if (value == null) return "—";
  if (compact) {
    if (Math.abs(value) >= 1_000_000_000)
      return `€${(value / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(value) >= 1_000_000)
      return `€${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
    return `€${value.toFixed(0)}`;
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPct(ratio: number | null | undefined): string {
  if (ratio == null) return "—";
  return `${(ratio * 100).toFixed(1)}%`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function ffpStatusColor(status: string): string {
  const s = status?.toLowerCase();
  if (s === "compliant") return "text-emerald-500";
  if (s === "warning") return "text-amber-500";
  if (s === "breach") return "text-red-500";
  return "text-muted-foreground";
}

export function ffpStatusBg(status: string): string {
  const s = status?.toLowerCase();
  if (s === "compliant")
    return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400";
  if (s === "warning")
    return "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400";
  if (s === "breach")
    return "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400";
  return "bg-muted text-muted-foreground border-border";
}

export function roleColor(role: string): string {
  switch (role) {
    case "admin":
      return "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400";
    case "sport_director":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400";
    case "user":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function roleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "sport_director":
      return "Sport Director";
    case "user":
      return "User";
    case "anonymous":
      return "Anonymous";
    default:
      return role;
  }
}

//  Human-readable error messages
const ERROR_MAP: Record<string, string> = {
  "HTTP 401": "Your session has expired. Please sign in again.",
  "HTTP 403": "You do not have permission to perform this action.",
  "HTTP 404": "The requested item was not found.",
  "HTTP 422": "Some fields are invalid. Please check your input.",
  "HTTP 429": "Too many requests. Please wait a moment and try again.",
  "HTTP 500": "Something went wrong on the server. Please try again later.",
  "HTTP 503": "The service is temporarily unavailable. Please try again later.",
  "Cannot reach the server":
    "Cannot connect to the server. Please check your connection.",
  "Session expired": "Your session has expired. Please sign in again.",
  "Not Found": "The requested item was not found.",
  "already exists": "This already exists. Please use a different name.",
  "already registered": "An account with this email already exists.",
  "Invalid credentials": "Incorrect email or password. Please try again.",
  "Incorrect password": "Incorrect password. Please try again.",
  "Invalid token": "Your session is invalid. Please sign in again.",
};

export function friendlyError(msg: string | null | undefined): string {
  if (!msg) return "Something went wrong. Please try again.";
  for (const [key, friendly] of Object.entries(ERROR_MAP)) {
    if (msg.includes(key)) return friendly;
  }
  // Clean up backend-style messages
  if (msg.startsWith("HTTP "))
    return `Request failed (${msg}). Please try again.`;
  if (msg.length > 120) return "Something went wrong. Please try again.";
  // Capitalize first letter
  return msg.charAt(0).toUpperCase() + msg.slice(1);
}
