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
  full_name: z.string().min(1, "Name required").max(100),
  username: z
    .string()
    .min(3, "Min 3 chars")
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, underscore only"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Min 8 characters"),
});
type F = z.infer<typeof schema>;

export default function RegisterPage() {
  const { register: registerUser, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<F>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
  });

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace("/simulations");
  }, [loading, isAuthenticated, router]);

  if (loading) return <PageLoader />;
  if (isAuthenticated) return null;

  const onSubmit = async (data: F) => {
    try {
      await registerUser(
        data.email,
        data.username,
        data.password,
        data.full_name,
      );
      toast.success("Account created!");
      router.push("/simulations");
    } catch (e: any) {
      toast.error(e.message || "Registration failed");
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
          <h1 className="text-2xl font-display font-bold">Create account</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Free forever. No credit card.
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
              label="Full name"
              placeholder="Your name"
              autoComplete="name"
              error={errors.full_name?.message}
              {...register("full_name")}
            />
            <Input
              label="Username"
              placeholder="coach_fergie"
              autoComplete="username"
              error={errors.username?.message}
              {...register("username")}
            />
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
              placeholder="Min 8 characters"
              autoComplete="new-password"
              helperText="At least 8 characters"
              error={errors.password?.message}
              {...register("password")}
            />
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Create account <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-5">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-primary font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
