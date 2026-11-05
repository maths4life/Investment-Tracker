import { useEffect, useState, useCallback } from 'react';

interface UseApiOptions<T> {
  immediate?: boolean;
  initialData?: T;
}

export function useApi<T>(
  fn: () => Promise<T>,
  options: UseApiOptions<T> = {}
) {
  const { immediate = true, initialData } = options;
  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (immediate) run();
  }, [immediate, run]);

  return { data, loading, error, refetch: run, setData };
}

