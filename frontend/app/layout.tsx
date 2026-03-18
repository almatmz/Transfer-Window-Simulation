import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
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
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body>
        <Providers>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            {/* Full-width, constrained by individual page max-w */}
            <main className="flex-1 w-full overflow-x-hidden">{children}</main>
            <Footer />
          </div>
          <Toaster
            position="top-center"
            richColors
            closeButton
            expand={false}
            visibleToasts={3}
          />
        </Providers>
      </body>
    </html>
  );
}
