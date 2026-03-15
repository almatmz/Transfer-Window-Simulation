"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth/context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button, Input, PageLoader } from "@/components/ui";
import { Trophy, ArrowRight } from "lucide-react";

const schema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password required"),
});
type F = z.infer<typeof schema>;

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<F>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
  });

  // Fix: use useEffect for redirect, never during render
  useEffect(() => {
    if (!loading && isAuthenticated) router.replace("/simulations");
  }, [loading, isAuthenticated, router]);

  if (loading) return <PageLoader />;
  if (isAuthenticated) return null;

  const onSubmit = async (data: F) => {
    try {
      await login(data.email, data.password);
      toast.success("Welcome back!");
      router.push("/simulations");
    } catch (e: any) {
      toast.error(e.message || "Login failed");
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary mb-4 shadow-md shadow-primary/20"
          >
            <Trophy className="w-5 h-5 text-white" />
          </Link>
          <h1 className="text-2xl font-display font-bold">Sign in</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Access your simulations and club data
          </p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
            noValidate
            autoComplete="on"
          >
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Sign in <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-5">
          No account?{" "}
          <Link
            href="/register"
            className="text-primary font-medium hover:underline"
          >
            Create one free
          </Link>
        </p>
      </div>
    </div>
  );
}
