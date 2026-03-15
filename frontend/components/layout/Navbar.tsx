'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth/context';
import { cn } from '@/lib/utils';
import { Moon, Sun, Trophy, ChevronDown, User, LogOut, BarChart3, Shield, Layers, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, isAuthenticated, logout, role } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  useEffect(() => setMounted(true), []);

  const handleLogout = () => {
    logout(); setMenuOpen(false);
    toast.success('Signed out');
    router.push('/');
  };

  const navLinks = [
    { href: '/clubs/search', label: 'Clubs', icon: <Layers className="w-3.5 h-3.5" /> },
    ...(mounted && isAuthenticated ? [{ href: '/simulations', label: 'Simulations', icon: <Activity className="w-3.5 h-3.5" /> }] : []),
    ...(mounted && (role === 'admin') ? [{ href: '/admin/users', label: 'Admin', icon: <Shield className="w-3.5 h-3.5" /> }] : []),
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav className="sticky top-0 z-50 glass border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-sm shadow-primary/20 group-hover:scale-110 transition-transform">
            <Trophy className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-display font-bold text-base hidden sm:flex items-center gap-0.5">
            <span className="text-gradient">Transfer</span>
            <span className="text-foreground/50 font-normal"> Window</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-0.5">
          {navLinks.map(link => (
            <Link key={link.href} href={link.href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                isActive(link.href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}>
              {link.icon}{link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {mounted && (
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
          {!mounted ? <div className="w-20 h-8" /> : isAuthenticated ? (
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-secondary transition-all">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white">
                  {user?.username?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <span className="hidden sm:block text-sm font-medium max-w-20 truncate">{user?.username}</span>
                <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', menuOpen && 'rotate-180')} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-scale-in">
                    <div className="px-3 py-2.5 border-b border-border bg-secondary/30">
                      <p className="text-sm font-semibold truncate">{user?.username}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <div className="p-1">
                      {[
                        { href: '/me', icon: User, label: 'Profile' },
                        { href: '/simulations', icon: Activity, label: 'My Simulations' },
                        ...(role === 'admin' ? [{ href: '/admin/users', icon: Shield, label: 'Admin Panel' }] : []),
                      ].map(item => (
                        <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-secondary transition-all">
                          <item.icon className="w-4 h-4 text-muted-foreground" />{item.label}
                        </Link>
                      ))}
                    </div>
                    <div className="p-1 border-t border-border">
                      <button onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-all">
                        <LogOut className="w-4 h-4" />Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link href="/login" className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">Sign in</Link>
              <Link href="/register" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-all shadow-sm">Get started</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
