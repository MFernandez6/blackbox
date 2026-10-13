"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { useTheme } from "@/lib/use-theme";

export function Providers({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <SessionProvider>
      {children}
      <Toaster
        theme={theme}
        position="bottom-right"
        toastOptions={{
          style: {
            background: "rgb(var(--brand-navy))",
            border: "1px solid rgb(var(--brand-gold) / 0.35)",
            borderRadius: 6,
            color: "rgb(var(--brand-white))",
            fontFamily: "var(--font-sans)",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          },
        }}
      />
    </SessionProvider>
  );
}
