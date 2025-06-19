import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let text = res.statusText;
    try {
      text = (await res.text()) || res.statusText;
    } catch (e) {
      console.error("Error reading response text:", e);
    }
    
    // Enhanced error logging for debugging
    console.error("=== API REQUEST FAILED ===");
    console.error("Status:", res.status);
    console.error("URL:", res.url);
    console.error("Status Text:", res.statusText);
    console.error("Response Text:", text);
    console.error("===========================");
    
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds instead of Infinity for better debugging
      retry: (failureCount, error) => {
        console.log(`Query retry ${failureCount}, error:`, error);
        return failureCount < 2; // Retry up to 2 times
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error) => {
        console.log(`Mutation retry ${failureCount}, error:`, error);
        return failureCount < 1; // Retry once
      },
    },
  },
});
