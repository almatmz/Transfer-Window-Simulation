'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/lib/auth/context';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 3,      // 3 min — data considered fresh
        gcTime:    1000 * 60 * 15,      // 15 min in memory
        retry: 1,
        retryDelay: 1000,
        refetchOnWindowFocus: false,    // Don't refetch just by switching tabs
        refetchOnReconnect: true,       // Do refetch when connection restored
        refetchOnMount: 'always',       // Always check on mount (fixes back navigation)
      },
    },
  }));

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
