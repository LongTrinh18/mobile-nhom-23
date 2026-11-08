import { useCallback, useEffect, useState } from 'react';
import { getBestSellers, getHomeCollections } from '../../services/home-service';

function useHomeResource<T>(fetcher: () => Promise<T>, enabled: boolean) {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => { setState({ data: null, error: null }); setAttempt(value => value + 1); }, []);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void fetcher().then(data => { if (active) setState({ data, error: null }); }).catch(() => {
      if (active) setState({ data: null, error: 'Chưa tải được dữ liệu mục này. Vui lòng thử lại sau.' });
    });
    return () => { active = false; };
  }, [fetcher, enabled, attempt]);
  return { data: enabled ? state.data : null, error: enabled ? state.error : null,
    loading: enabled && state.data === null && state.error === null, retry };
}
/** Public merchandise sources load independently; a missing collection service never blocks offers or new arrivals. */
export function useHomeMerchandising(options: { bestsellers?: boolean; collections?: boolean } = {}) {
  const bestsellers = useHomeResource(getBestSellers, options.bestsellers ?? true);
  const collections = useHomeResource(getHomeCollections, options.collections ?? true);
  return { bestsellers, collections };
}
