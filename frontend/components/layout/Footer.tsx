import Link from "next/link";
import { Trophy, Shield, BarChart3, Users, Activity } from "lucide-react";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border mt-auto">
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div className="sm:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Trophy className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-display font-bold">Transfer Window</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Professional football transfer simulation with FFP compliance
              analysis.
            </p>
          </div>

          {/* Features */}
          <div>
            <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-4">
              Features
            </p>
            <ul className="space-y-2.5">
              {[
                { href: "/clubs/search", icon: Users, label: "Club Search" },
                { href: "/simulations", icon: Activity, label: "Simulations" },
                { href: "/ffp", icon: BarChart3, label: "FFP Analysis" },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <item.icon className="w-3.5 h-3.5 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-4">
              Info
            </p>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 shrink-0" />
                Data from API-Football
              </li>
              <li>Salary estimates via Capology</li>
              <li>FFP rules: UEFA regulations</li>
              <li>For educational use only</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            © {year} Transfer Window Simulator
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <Link
              href="/register"
              className="hover:text-foreground transition-colors"
            >
              Create Account
            </Link>
            <Link
              href="/clubs/search"
              className="hover:text-foreground transition-colors"
            >
              Search Clubs
            </Link>
            <Link
              href="/login"
              className="hover:text-foreground transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
