import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cartItemKey, type CartItem } from '../types/shop';

type ItemDraft = Omit<CartItem, 'key' | 'quantity'>;
type CartApi = {
  items: CartItem[];
  count: number;
  totalVnd: number;
  addItem: (draft: ItemDraft, quantity: number) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartApi | undefined>(undefined);

/** N4/N6 interface for C: both people must import this provider/hook. */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const addItem = useCallback((draft: ItemDraft, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity <= 0 || draft.maxAvailable <= 0) return;
    setItems(previous => {
      const key = cartItemKey(draft.skuId, draft.branchId);
      const current = previous.find(item => item.key === key);
      const cap = Math.max(0, Math.floor(draft.maxAvailable));
      if (current) return previous.map(item => item.key === key ? {
        ...item,
        maxAvailable: cap,
        quantity: Math.min(cap, item.quantity + quantity),
      } : item);
      return [...previous, { ...draft, key, quantity: Math.min(quantity, cap) }];
    });
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    if (!Number.isInteger(quantity)) return;
    if (quantity <= 0) {
      setItems(items => items.filter(item => item.key !== key));
    } else {
      setItems(items => items.map(item => item.key === key
        ? { ...item, quantity: Math.min(quantity, item.maxAvailable) } : item));
    }
  }, []);

  const removeItem = useCallback((key: string) => setItems(items => items.filter(item => item.key !== key)), []);
  const clearCart = useCallback(() => setItems([]), []);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalVnd = items.reduce((sum, item) => sum + item.unitPriceVnd * item.quantity, 0);
  const api = useMemo(() => ({ items, count, totalVnd, addItem, updateQuantity, removeItem, clearCart }),
    [items, count, totalVnd, addItem, updateQuantity, removeItem, clearCart]);
  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
