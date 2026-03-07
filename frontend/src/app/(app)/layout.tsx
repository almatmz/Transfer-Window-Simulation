"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { authApi } from "@/services/api/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const token = useAuthStore.getState().accessToken;
      if (!token) {
        router.replace("/login");
        return;
      }
      authApi
        .me()
        .then((user) => {
          setUser(user);
          setReady(true);
        })
        .catch(() => router.replace("/login"));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!ready)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--c-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "3px solid #1e3a5f",
            borderTopColor: "#3b82f6",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );

  return <>{children}</>;
}
