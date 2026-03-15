import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/layout/Navbar";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: { default: "Transfer Window", template: "%s · Transfer Window" },
  description:
    "Simulate football transfer windows with full FFP impact analysis.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1 overflow-x-hidden">{children}</main>
          </div>
          <Toaster position="top-right" richColors closeButton expand={false} />
        </Providers>
      </body>
    </html>
  );
}
