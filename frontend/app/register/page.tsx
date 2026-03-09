"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { registerSchema } from "@/lib/schemas";
import { useAuth } from "@/lib/auth/context";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { Trophy, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

type FormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register: registerUser, isAuthenticated } = useAuth();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(registerSchema),
    mode: "onSubmit",
  });

  if (isAuthenticated) {
    router.replace("/");
    return null;
  }

  const onSubmit = async (data: FormData) => {
    try {
      await registerUser(
        data.email,
        data.username,
        data.password,
        data.full_name,
      );
      toast.success("Account created! Welcome aboard.");
      router.push("/");
    } catch (e: any) {
      toast.error(e.message || "Registration failed");
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
          <h1 className="text-2xl font-display font-black">Create account</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Free. No credit card required.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Full name"
              placeholder="Your name"
              error={errors.full_name?.message}
              {...register("full_name")}
            />
            <Input
              label="Username"
              placeholder="coach_fergie"
              error={errors.username?.message}
              {...register("username")}
            />
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
              placeholder="Min 8 characters"
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
      </motion.div>
    </div>
  );
}
