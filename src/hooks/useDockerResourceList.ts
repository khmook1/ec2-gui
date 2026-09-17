import { useCallback, useEffect, useRef, useState } from "react";

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

interface UseDockerResourceListOptions<T> {
  fetcher: () => Promise<T[]>;
  errorFallback: string;
}

export function useDockerResourceList<T>({
  fetcher,
  errorFallback,
}: UseDockerResourceListOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [hasCache, setHasCache] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  const hasCacheRef = useRef(false);
  fetcherRef.current = fetcher;

  const fetchList = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      setIsFetching(true);
      if (force) {
        setErrorMessage(null);
      }

      try {
        const next = await fetcherRef.current();
        setItems(next);
        hasCacheRef.current = true;
        setHasCache(true);
        setErrorMessage(null);
      } catch (error) {
        const message = getErrorMessage(error, errorFallback);
        setErrorMessage(message);
        if (!hasCacheRef.current) {
          setItems([]);
          setHasCache(false);
        }
      } finally {
        setIsFetching(false);
      }
    },
    [errorFallback],
  );

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const refresh = useCallback(() => fetchList({ force: true }), [fetchList]);

  return {
    items,
    hasCache,
    isFetching,
    errorMessage,
    refresh,
  };
}
