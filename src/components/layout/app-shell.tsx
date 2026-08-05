"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type AppShellProps = {
  children: React.ReactNode;
  user: { name: string; email: string; role: string };
};

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();

  const nav = [
    { href: "/dashboard", label: "Files" },
    { href: "/claims/new", label: "Intake" },
  ];

  return (
    <div className="min-h-screen bg-ink text-paper">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-10">
            <Link href="/dashboard" className="group">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                Blackline Public Adjusters
              </p>
              <p className="font-serif text-xl tracking-tight text-paper group-hover:text-paper/90">
                BLACKBOX
              </p>
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
                    pathname.startsWith(item.href)
                      ? "text-paper"
                      : "text-muted-foreground hover:text-paper"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {user.role}
              </p>
              <p className="text-sm text-paper/90">{user.name}</p>
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
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-8 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
