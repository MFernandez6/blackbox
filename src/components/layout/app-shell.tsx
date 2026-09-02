"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BlackboxMark } from "@/components/brand/blackbox-mark";
import { IdleSessionGuard } from "@/components/layout/idle-session-guard";

type AppShellProps = {
  children: React.ReactNode;
  user: { name: string; email: string; role: string };
};

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();

  const nav = [{ href: "/dashboard", label: "Files" }];

  return (
    <div className="min-h-screen bg-brand-navy text-brand-white">
      <header className="no-print sticky top-0 z-50 border-b border-brand-white/5 bg-brand-navy/95 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1400px] min-w-0 items-center justify-between gap-4 px-4 sm:gap-6 sm:px-6">
          <div className="flex min-w-0 items-center gap-6 sm:gap-10">
            <Link href="/dashboard" className="group shrink-0">
              <div className="flex flex-col leading-none">
                <BlackboxMark className="font-serif text-xl font-bold tracking-[0.2em] text-brand-gold sm:text-2xl" />
                <span className="mt-1.5 font-sans text-[9px] font-bold uppercase tracking-[0.18em] text-brand-slate">
                  For Blackline Public Adjusters LLC
                </span>
              </div>
            </Link>
            <nav className="hidden items-center gap-8 md:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "font-sans text-[10px] font-bold uppercase tracking-[0.2em] transition-colors",
                    pathname.startsWith(item.href)
                      ? "text-brand-gold"
                      : "text-brand-white/70 hover:text-brand-gold"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-brand-slate">
                {user.role}
              </p>
              <p className="text-sm text-brand-white/90">{user.name}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Sign out
            </Button>
          </div>
        </div>
        <nav className="flex gap-4 overflow-x-auto border-t border-brand-white/5 px-4 py-2 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 font-sans text-[10px] font-bold uppercase tracking-[0.2em]",
                pathname.startsWith(item.href)
                  ? "text-brand-gold"
                  : "text-brand-white/70"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <IdleSessionGuard />
      <main
        className={cn(
          "mx-auto max-w-[1400px] px-4 py-6 animate-fade-in sm:px-6 sm:py-8",
          pathname.includes("/print") && "print:max-w-none print:px-0 print:py-0"
        )}
      >
        {children}
      </main>
    </div>
  );
}
