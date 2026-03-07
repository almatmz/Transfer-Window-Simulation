"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import {
  LayoutDashboard,
  Search,
  Activity,
  TrendingUp,
  User,
  Shield,
  LogOut,
  Trophy,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clubs", label: "Clubs", icon: Search },
  { href: "/simulations", label: "Simulations", icon: Activity },
  { href: "/ffp", label: "FFP Analyzer", icon: TrendingUp },
  { href: "/profile", label: "Profile", icon: User },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAdmin } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className="px-4 py-5 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/40 flex-shrink-0">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight truncate">
              TW Simulator
            </p>
            <p
              className="text-[10px] truncate"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              FFP Financial Tool
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg ml-2 flex-shrink-0"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p
          className="px-3 mb-2 text-[9px] font-bold uppercase tracking-[0.15em]"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Navigation
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn("nav-link", active && "active")}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{label}</span>
              {active && (
                <ChevronRight className="w-3 h-3 ml-auto opacity-50 flex-shrink-0" />
              )}
            </Link>
          );
        })}
        {isAdmin() && (
          <>
            <p
              className="px-3 mt-5 mb-2 text-[9px] font-bold uppercase tracking-[0.15em]"
              style={{ color: "rgba(255,255,255,0.2)" }}
            >
              System
            </p>
            <Link
              href="/admin"
              onClick={onClose}
              className={cn(
                "nav-link",
                pathname.startsWith("/admin") && "active",
              )}
            >
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>Admin Panel</span>
            </Link>
          </>
        )}
      </nav>

      {/* User + logout */}
      <div
        className="px-3 py-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {user && (
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 mb-2 rounded-xl"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {(user.full_name || user.username)[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">
                {user.full_name || user.username}
              </p>
              <p
                className="text-[10px] capitalize truncate"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {user.role.replace("_", " ")}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="nav-link w-full"
          style={{ color: "rgba(255,100,100,0.7)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239,68,68,0.08)";
            e.currentTarget.style.color = "#f87171";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "";
            e.currentTarget.style.color = "rgba(255,100,100,0.7)";
          }}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 w-9 h-9 rounded-xl flex items-center justify-center"
        style={{
          background: "var(--c-sidebar)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Menu className="w-4 h-4 text-slate-400" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="relative w-60 h-full"
            style={{ background: "var(--c-sidebar)" }}
          >
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-60 min-h-screen fixed left-0 top-0 z-30"
        style={{
          background: "var(--c-sidebar)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
