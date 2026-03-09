"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { loginSchema } from "@/lib/schemas";
import { useAuth } from "@/lib/auth/context";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { Trophy, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

type FormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit",
  });

  if (isAuthenticated) {
    router.replace("/");
    return null;
  }

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password);
      toast.success("Welcome back!");
      router.push("/");
    } catch (e: any) {
      toast.error(e.message || "Login failed");
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/30"
          >
            <Trophy className="w-6 h-6 text-white" />
          </Link>
          <h1 className="text-2xl font-display font-black">Sign in</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Access your simulations and club data
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
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
      </motion.div>
    </div>
  );
}
