'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth/context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button, Input, PageLoader } from '@/components/ui';
import { Trophy, ArrowRight, Eye, EyeOff, Info } from 'lucide-react';
import { friendlyError } from '@/lib/utils';

const schema = z.object({
  email: z.string().min(1,'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1,'Password is required'),
});
type F = z.infer<typeof schema>;

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(schema), mode: 'onSubmit',
  });

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace('/');
  }, [loading, isAuthenticated, router]);

  if (loading) return <PageLoader />;
  if (isAuthenticated) return null;

  const onSubmit = async (data: F) => {
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!');
      router.push('/'); // ← landing page, not simulations
    } catch (e: any) { toast.error(friendlyError(e.message)); }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary mb-4 shadow-md shadow-primary/20">
            <Trophy className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-2xl font-display font-bold">Welcome back</h1>
          <p className="text-muted-foreground text-sm mt-1">Sign in to your Transfer Window account</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate autoComplete="on">
            <Input label="Email address" type="email" placeholder="you@example.com" autoComplete="email"
              error={errors.email?.message} {...register('email')} />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password"
                  className={`w-full h-9 px-3 pr-10 rounded-xl border bg-background text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground ${errors.password ? 'border-destructive focus:ring-destructive/30' : 'border-input'}`}
                  {...register('password')} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-destructive flex items-center gap-1"><Info className="w-3 h-3"/>{errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full" loading={isSubmitting}>
              Sign in <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border"/></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
          </div>

          {/* Google OAuth placeholder — ready when backend supports it */}
          <button type="button" disabled
            className="w-full flex items-center justify-center gap-3 h-9 px-4 rounded-xl border border-border bg-background text-sm text-muted-foreground opacity-50 cursor-not-allowed"
            title="Coming soon">
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google <span className="text-xs opacity-60">(coming soon)</span>
          </button>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-5">
          New to Transfer Window?{' '}
          <Link href="/register" className="text-primary font-medium hover:underline">Create a free account</Link>
        </p>
      </div>
    </div>
  );
}
