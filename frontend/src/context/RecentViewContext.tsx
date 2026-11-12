import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Product } from '../types/shop';

const MAX_RECENT_ITEMS = 10;
const RECENT_VIEW_KEY = '@uniqlo_recent_views';

type RecentViewApi = {
  recentItems: Product[];
  addRecentItem: (product: Product) => void;
  clearRecentItems: () => void;
};

const RecentViewContext = createContext<RecentViewApi | undefined>(undefined);

export function RecentViewProvider({ children }: { children: ReactNode }) {
  const [recentItems, setRecentItems] = useState<Product[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(RECENT_VIEW_KEY).then((data: string | null) => {
      if (data) {
        try {
          setRecentItems(JSON.parse(data));
        } catch (e) {
          console.error('Failed to parse recent items', e);
        }
      }
    });
  }, []);

  const addRecentItem = useCallback((product: Product) => {
    setRecentItems(prev => {
      const filtered = prev.filter(p => p.id !== product.id);
      const updated = [product, ...filtered].slice(0, MAX_RECENT_ITEMS);
      AsyncStorage.setItem(RECENT_VIEW_KEY, JSON.stringify(updated)).catch(console.error);
      return updated;
    });
  }, []);

  const clearRecentItems = useCallback(() => {
    setRecentItems([]);
    AsyncStorage.removeItem(RECENT_VIEW_KEY).catch(console.error);
  }, []);

  return (
    <RecentViewContext.Provider value={{ recentItems, addRecentItem, clearRecentItems }}>
      {children}
    </RecentViewContext.Provider>
  );
}

export function useRecentView(): RecentViewApi {
  const value = useContext(RecentViewContext);
  if (!value) throw new Error('useRecentView must be used inside RecentViewProvider');
  return value;
}
