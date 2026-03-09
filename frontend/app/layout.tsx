import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Navbar } from '@/components/layout/Navbar';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Transfer Window Simulator',
  description: 'Simulate football transfer windows with full FFP impact analysis.',
  keywords: ['football', 'transfers', 'FFP', 'Financial Fair Play', 'simulation'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1">
              {children}
            </main>
          </div>
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              style: { fontFamily: 'var(--font-geist-sans, DM Sans, system-ui)' },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
