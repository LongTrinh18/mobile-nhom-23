import { useCallback, useEffect, useState } from 'react';
import { getCatalog } from '../../services/catalog-service';
import type { Catalog } from '../../types/shop';

export function useCatalog() {
  const [data, setData] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryNumber, setRetryNumber] = useState(0);

  const retry = useCallback(() => setRetryNumber(n => n + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getCatalog().then(catalog => {
      if (active) setData(catalog);
    }).catch((e: unknown) => {
      if (active) {
        setData(null);
        setError(e instanceof Error ? e.message : 'Không thể tải dữ liệu');
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [retryNumber]);

  return { data, loading, error, retry };
}
