"use client";

import { useState } from "react";
import {
  QueryClient,
  QueryClientConfig,
  QueryClientProvider,
} from "@tanstack/react-query";
import { AxiosError } from "axios";
import { defaultShouldDehydrateQuery } from "@tanstack/react-query";

// Client-side
const defaultQueryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retryDelay: 1000,
      retry(failureCount, error) {
        console.error(error);
        if (error instanceof AxiosError) {
          if (error.response?.status === undefined) {
            return false;
          }
        }

        return !!(3 - failureCount);
      },
    },
    dehydrate: {
      shouldDehydrateQuery: (query) =>
        defaultShouldDehydrateQuery(query) || query.state.status === "pending",
    },
  },
};

export function ReactQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () => new QueryClient(defaultQueryClientConfig),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
