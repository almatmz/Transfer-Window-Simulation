"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/auth/context";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 min default stale time
            gcTime: 1000 * 60 * 30, // 30 min in memory
            retry: 1,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
