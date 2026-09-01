"use client";

import { useEffect } from "react";

/**
 * Registers the app-shell service worker (public/sw.js) once the app has
 * mounted in the browser. Scoped purely to PWA installability/caching —
 * does not touch certificate data, IndexedDB, or sync logic.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }, []);

  return null;
}
