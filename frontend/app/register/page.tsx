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
import { Trophy, ArrowRight, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { friendlyError } from '@/lib/utils';

const schema = z.object({
  full_name: z.string().min(2,'Name must be at least 2 characters').max(100,'Name too long'),
  username: z.string()
    .min(3,'Username must be at least 3 characters')
    .max(30,'Username must be under 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores allowed'),
  email: z.string().min(1,'Email is required').email('Please enter a valid email address'),
  password: z.string()
    .min(8,'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword'],
});
type F = z.infer<typeof schema>;

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /[0-9]/.test(password) },
  ];
  if (!password) return null;
  return (
    <div className="space-y-1 mt-2">
      {checks.map(c => (
        <div key={c.label} className={`flex items-center gap-1.5 text-xs ${c.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
          {c.ok ? <CheckCircle className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>}
          {c.label}
        </div>
      ))}
    </div>
  );
}

export default function RegisterPage() {
  const { register: registerUser, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(schema), mode: 'onBlur',
  });
  const password = watch('password','');

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace('/');
  }, [loading, isAuthenticated, router]);

  if (loading) return <PageLoader />;
  if (isAuthenticated) return null;

  const onSubmit = async (data: F) => {
    try {
      await registerUser(data.email, data.username, data.password, data.full_name);
      toast.success('Account created! Welcome to Transfer Window.');
      router.push('/');
    } catch (e: any) { toast.error(friendlyError(e.message)); }
  };

  const pwInput = (show: boolean, toggle: () => void, field: any, error?: string, placeholder = 'Password') => (
    <div className="relative">
      <input type={show ? 'text' : 'password'} placeholder={placeholder}
        className={`w-full h-9 px-3 pr-10 rounded-xl border bg-background text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-muted-foreground ${error ? 'border-destructive focus:ring-destructive/30' : 'border-input'}`}
        {...field} />
      <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
        {show ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
      </button>
    </div>
  );

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary mb-4 shadow-md shadow-primary/20">
            <Trophy className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-2xl font-display font-bold">Create your account</h1>
          <p className="text-muted-foreground text-sm mt-1">Free forever · No credit card required</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate autoComplete="on">
            <Input label="Full name" placeholder="Your full name" autoComplete="name"
              error={errors.full_name?.message} {...register('full_name')} />
            <Input label="Username" placeholder="e.g. coach_fergie" autoComplete="username"
              helperText="Letters, numbers and underscores only"
              error={errors.username?.message} {...register('username')} />
            <Input label="Email address" type="email" placeholder="you@example.com" autoComplete="email"
              error={errors.email?.message} {...register('email')} />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Password</label>
              {pwInput(showPw, ()=>setShowPw(v=>!v), register('password'), errors.password?.message, 'Create a password')}
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
              <PasswordStrength password={password}/>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Confirm password</label>
              {pwInput(showConfirm, ()=>setShowConfirm(v=>!v), register('confirmPassword'), errors.confirmPassword?.message, 'Repeat your password')}
              {errors.confirmPassword && <p className="text-xs text-destructive mt-1">{errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Create account <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-5">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
