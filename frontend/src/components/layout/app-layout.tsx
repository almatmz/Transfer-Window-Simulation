"use client";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function AppLayout({ children, title, className }: AppLayoutProps) {
  return (
    <div className="min-h-screen" style={{ background: "var(--c-bg)" }}>
      <Sidebar />
      <div className="lg:ml-60 flex flex-col min-h-screen">
        <Topbar title={title} />
        <main className={cn("flex-1 p-5 sm:p-7 animate-fade-in", className)}>
          {children}
        </main>
      </div>
    </div>
  );
}
