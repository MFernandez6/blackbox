"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

/** Sign out after this long with no user interaction. */
const IDLE_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
  "wheel",
];

/**
 * Client-side idle watchdog — logs the user out after 5 minutes of inactivity.
 */
export function IdleSessionGuard() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    const arm = () => {
      clear();
      timerRef.current = setTimeout(() => {
        void signOut({ callbackUrl: "/login?reason=idle" });
      }, IDLE_MS);
    };

    arm();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, arm, { passive: true });
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") arm();
    });

    return () => {
      clear();
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, arm);
      }
    };
  }, []);

  return null;
}
