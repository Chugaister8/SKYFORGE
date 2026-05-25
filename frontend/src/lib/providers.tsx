"use client";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { TelemetryProvider } from "@/components/providers/TelemetryProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1 } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <TelemetryProvider>{children}<OfflineBanner />
    </TelemetryProvider>
    </QueryClientProvider>
  );
}
