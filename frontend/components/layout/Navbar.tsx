"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils";
import {
  Moon,
  Sun,
  Trophy,
  ChevronDown,
  User,
  LogOut,
  Shield,
  Layers,
  Activity,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, isAuthenticated, logout, role } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    setMobileOpen(false);
    toast.success("Signed out");
    router.push("/");
  };

  // Desktop nav — clean, no duplicates
  const desktopLinks = [
    { href: "/clubs/search", label: "Clubs", icon: Layers, always: true },
    { href: "/simulations", label: "Simulations", icon: Activity, auth: true },
    { href: "/admin/users", label: "Admin", icon: Shield, adminOnly: true },
  ].filter((l) => {
    if (!mounted) return l.always;
    if (l.adminOnly) return role === "admin";
    if (l.auth) return isAuthenticated;
    return true;
  });

  // Mobile drawer links — single unified list
  const drawerLinks = [
    { href: "/clubs/search", label: "Clubs", icon: Layers, always: true },
    { href: "/simulations", label: "Simulations", icon: Activity, auth: true },
    { href: "/me", label: "Profile", icon: User, auth: true },
    { href: "/admin/users", label: "Admin", icon: Shield, adminOnly: true },
  ].filter((l) => {
    if (!mounted) return l.always;
    if (l.adminOnly) return role === "admin";
    if (l.auth) return isAuthenticated;
    return true;
  });

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Navbar — z-30 so modal at z-50 always covers it */}
      <nav className="sticky top-0 z-30 border-b border-border bg-card/95 supports-[backdrop-filter]:bg-card/85 supports-[backdrop-filter]:backdrop-blur-md">
        <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-sm shadow-primary/20 group-hover:scale-110 transition-transform">
              <Trophy className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-bold text-base flex items-center gap-0.5">
              <span className="text-gradient">Transfer</span>
              <span className="text-foreground/50 font-normal hidden sm:inline">
                {" "}
                Window
              </span>
            </span>
          </Link>

          {/* Desktop links — centered */}
          <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
            {desktopLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                  isActive(link.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                )}
              >
                <link.icon className="w-3.5 h-3.5" />
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-1.5">
            {/* Theme toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
            )}

            {/* Desktop: user dropdown */}
            {mounted && isAuthenticated && (
              <div className="relative hidden md:block">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg hover:bg-secondary transition-all"
                >
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {user?.username?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <span className="text-sm font-medium max-w-[80px] truncate hidden lg:block">
                    {user?.username}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 text-muted-foreground transition-transform",
                      userMenuOpen && "rotate-180",
                    )}
                  />
                </button>
                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1.5 w-52 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-scale-in">
                      <div className="px-3 py-2.5 border-b border-border">
                        <p className="text-sm font-semibold truncate">
                          {user?.username}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user?.email}
                        </p>
                      </div>
                      <div className="p-1">
                        <Link
                          href="/me"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-secondary transition-all"
                        >
                          <User className="w-4 h-4 text-muted-foreground" />
                          Profile
                        </Link>
                        {role === "admin" && (
                          <Link
                            href="/admin/users"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-secondary transition-all"
                          >
                            <Shield className="w-4 h-4 text-muted-foreground" />
                            Admin Panel
                          </Link>
                        )}
                      </div>
                      <div className="p-1 border-t border-border">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-all"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Desktop: auth buttons */}
            {mounted && !isAuthenticated && (
              <div className="hidden md:flex items-center gap-1.5">
                <Link
                  href="/login"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-all shadow-sm"
                >
                  Get started
                </Link>
              </div>
            )}

            {/* Mobile burger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              aria-label="Menu"
            >
              {mobileOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile drawer — z-40 so it's above navbar but below modals (z-50) */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed top-0 right-0 bottom-0 z-50 w-72 max-w-[85vw] bg-card border-l border-border shadow-2xl md:hidden animate-slide-in flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
              <span className="font-display font-bold text-base">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 -mr-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User info */}
            {mounted && isAuthenticated && user && (
              <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-secondary/40 shrink-0">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {user.username?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {user.username}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            )}

            {/* Links */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {drawerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all",
                    isActive(link.href)
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-secondary",
                  )}
                >
                  <link.icon className="w-4 h-4 shrink-0" />
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Bottom actions */}
            <div className="p-3 border-t border-border mt-auto shrink-0 bg-card">
              {mounted && isAuthenticated ? (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-secondary transition-all"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-all"
                  >
                    Get started
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
