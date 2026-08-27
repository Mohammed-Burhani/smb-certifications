"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

// SSR-safe singleton: one client per browser session, a fresh one per server render.
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always create a new client so requests are isolated.
    return new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });
  }
  // Browser: reuse the same client across renders so the cache is preserved.
  browserQueryClient ??= new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });
  return browserQueryClient;
}

export default function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
