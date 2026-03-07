"use client";
import { useAuthStore } from "@/store/auth";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import Link from "next/link";

const roleBadge: Record<string, "info" | "success" | "warning"> = {
  admin: "warning",
  sport_director: "success",
  user: "info",
};

export function Topbar({ title }: { title?: string }) {
  const { user } = useAuthStore();
  return (
    <header
      className="h-14 flex items-center justify-between px-5 sticky top-0 z-20"
      style={{
        background: "var(--c-surface)",
        borderBottom: "1px solid var(--c-border)",
      }}
    >
      <h1 className="text-base font-semibold c-text pl-12 lg:pl-0">{title}</h1>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {user && (
          <Link href="/profile">
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl cursor-pointer transition-all hover:opacity-80"
              style={{ background: "var(--c-bg-raised)" }}
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                {(user.full_name || user.username)[0]?.toUpperCase()}
              </div>
              <Badge
                variant={roleBadge[user.role] || "info"}
                className="hidden sm:flex text-[10px]"
              >
                {user.role.replace("_", " ")}
              </Badge>
            </div>
          </Link>
        )}
      </div>
    </header>
  );
}
