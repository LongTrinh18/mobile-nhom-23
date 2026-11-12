import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { addToCart, getCart, removeFromCart, setCartQuantity, clearServerCart } from '../api/cartApi';
import { placeOrder } from '../api/orderApi';
import { ApiError, friendlyMessage } from '../api/errors';
import type { PlaceOrderResult } from '../api/types';
import { supabase } from '../lib/supabase';
import { getCatalog } from '../services/catalog-service';
import { variantPurchaseLimit } from '../services/product-purchase';
import { hydrateCart, validateOrderItems } from '../services/cart-adapter';
import { cartItemKey, type Branch, type CartItem } from '../types/shop';

type ItemDraft = Omit<CartItem, 'key' | 'quantity' | 'branchId' | 'branchName' | 'maxAvailable'>;
type Customer = {
  customerName: string;
  customerPhone: string;
  fulfillmentType?: 'pickup' | 'delivery';
  branchId?: string;
  deliveryAddress?: string;
  voucherCode?: string;
  note?: string;
  idempotencyKey?: string;
};
type CartApi = {
  items: CartItem[];
  count: number;
  totalVnd: number;
  selectedKeys: string[];
  selectedItems: CartItem[];
  selectedCount: number;
  selectedTotalVnd: number;
  loading: boolean;
  error: string | null;
  userId: string | null;
  branches: Branch[];
  branchId: string;
  refresh: () => Promise<void>;
  selectBranch: (id: string) => Promise<void>;
  addItem: (draft: ItemDraft, quantity: number) => Promise<void>;
  updateQuantity: (key: string, quantity: number) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  clearCart: () => Promise<void>;
  toggleSelectItem: (key: string) => void;
  toggleSelectAll: (selected?: boolean) => void;
  submitOrder: (customer: Customer) => Promise<PlaceOrderResult>;
};

const CartContext = createContext<CartApi | undefined>(undefined);
export function cartErrorMessage(error: unknown): string {
  return error instanceof ApiError ? friendlyMessage(error)
    : error instanceof Error ? error.message : 'Không thể cập nhật giỏ hàng. Vui lòng thử lại.';
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef(items);
  const selectedKeysRef = useRef(selectedKeys);
  selectedKeysRef.current = selectedKeys;
  const branchRef = useRef('');
  const ownerRef = useRef<string | null>(null);
  const epochRef = useRef(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  const commit = useCallback((next: CartItem[]) => {
    itemsRef.current = next;
    setItems(next);
    setSelectedKeys(prev => {
      const nextKeys = new Set(next.map(i => i.key));
      const prevKeysSet = new Set(prev);
      if (prev.length === 0) return next.map(i => i.key);
      const kept = prev.filter(k => nextKeys.has(k));
      for (const item of next) {
        if (!prevKeysSet.has(item.key) && !kept.includes(item.key)) {
          kept.push(item.key);
        }
      }
      return kept;
    });
  }, []);

  const load = useCallback(async (owner: string, epoch: number, selectedBranch = branchRef.current) => {
    const [rows, catalog] = await Promise.all([getCart(), getCatalog()]);
    if (!mountedRef.current || ownerRef.current !== owner || epochRef.current !== epoch) return;
    const next = hydrateCart(rows, catalog, selectedBranch);
    branchRef.current = next.branchId;
    setBranchId(next.branchId);
    setBranches(next.branches);
    commit(next.items);
  }, [commit]);

  useEffect(() => {
    mountedRef.current = true;
    if (!supabase) return () => { mountedRef.current = false; };
    const invalidateRequests = () => { epochRef.current += 1; };
    let initialized = false;
    let receivedEvent = false;
    const applySession = (id: string | null) => {
      if (!mountedRef.current || (initialized && ownerRef.current === id)) return;
      initialized = true;
      ownerRef.current = id;
      const epoch = ++epochRef.current;
      setUserId(id);
      commit([]);
      branchRef.current = '';
      setBranchId('');
      setBranches([]);
      setError(null);
      setLoading(Boolean(id));
      // Do not await Supabase requests inside the auth callback (auth holds a lock).
      if (id) void Promise.resolve().then(() => load(id, epoch)).catch(e => {
        if (mountedRef.current && epochRef.current === epoch) setError(cartErrorMessage(e));
      }).finally(() => {
        if (mountedRef.current && epochRef.current === epoch) setLoading(false);
      });
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedEvent = true;
      applySession(session?.user.id ?? null);
    });
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (receivedEvent || !mountedRef.current) return;
      if (sessionError) {
        setError(cartErrorMessage(sessionError));
        setLoading(false);
      } else applySession(data.session?.user.id ?? null);
    }).catch(e => {
      if (mountedRef.current && !receivedEvent) { setError(cartErrorMessage(e)); setLoading(false); }
    });
    return () => {
      mountedRef.current = false;
      invalidateRequests();
      subscription.unsubscribe();
    };
  }, [commit, load]);

  // Serialize changes, preserve server state on failure, and discard late results after account changes.
  const run = useCallback(async <T,>(action: (owner: string | null, epoch: number) => Promise<T>): Promise<T> => {
    if (busyRef.current) throw new Error('Giỏ hàng đang cập nhật. Vui lòng chờ.');
    const owner = ownerRef.current;
    if (supabase && !owner) throw new ApiError('NOT_AUTHENTICATED', 'Bạn cần đăng nhập');
    const epoch = epochRef.current;
    busyRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await action(owner, epoch);
      if (epochRef.current !== epoch) throw new Error('Tài khoản đã thay đổi. Vui lòng thử lại.');
      return result;
    } catch (e) {
      if (mountedRef.current && epochRef.current === epoch) setError(cartErrorMessage(e));
      throw e;
    } finally {
      busyRef.current = false;
      if (mountedRef.current && epochRef.current === epoch) setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => run(async (owner, epoch) => {
    if (owner) await load(owner, epoch);
  }), [load, run]);

  const selectBranch = useCallback((id: string) => run(async (owner, epoch) => {
    if (owner) await load(owner, epoch, id);
    else {
      const catalog = await getCatalog();
      const branch = catalog.branches.find(item => item.id === id);
      if (!branch) throw new Error('Vui lòng chọn chi nhánh đang hoạt động.');
      branchRef.current = id; setBranchId(id); setBranches(catalog.branches);
      commit(itemsRef.current.map(item => ({ ...item, key: cartItemKey(item.skuId, id), branchId: id, branchName: branch.name,
        maxAvailable: Math.min(10, Math.max(0, catalog.stock.find(row => row.skuId === item.skuId && row.branchId === id)?.quantity ?? 0)) })));
    }
  }), [commit, load, run]);

  const addItem = useCallback((draft: ItemDraft, quantity: number) => run(async (owner, epoch) => {
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Số lượng không hợp lệ.');
    const [catalog, rows] = await Promise.all([getCatalog(), owner ? getCart() : Promise.resolve([])]);
    if (epochRef.current !== epoch) throw new Error('Tài khoản đã thay đổi.');
    const product = catalog.products.find(item => item.id === draft.productId);
    if (!product?.variants.some(variant => variant.id === draft.skuId)) throw new Error('Sản phẩm này hiện không còn bán.');
    const limit = variantPurchaseLimit(catalog, draft.skuId);
    const existing = owner ? rows.find(row => row.variant_id === draft.skuId)?.quantity ?? 0
      : itemsRef.current.find(item => item.skuId === draft.skuId)?.quantity ?? 0;
    if (existing + quantity > limit) throw new Error('Số lượng vượt quá tồn kho hoặc giới hạn 10 sản phẩm mỗi SKU.');
    if (owner) {
      await addToCart(draft.skuId, quantity);
      // Adding a SKU does not silently choose or change the pickup branch.
      await load(owner, epoch);
    } else {
      const branch = catalog.branches.find(item => item.id === branchRef.current) ?? catalog.branches[0];
      if (!branch) throw new Error('Chưa có cửa hàng đang hoạt động.');
      branchRef.current = branch.id; setBranchId(branch.id); setBranches(catalog.branches);
      const key = cartItemKey(draft.skuId, branch.id);
      const item: CartItem = { ...draft, key, branchId: branch.id, branchName: branch.name,
        quantity: existing + quantity, maxAvailable: Math.min(10, Math.max(0,
          catalog.stock.find(row => row.skuId === draft.skuId && row.branchId === branch.id)?.quantity ?? 0)) };
      commit(existing ? itemsRef.current.map(line => line.skuId === draft.skuId ? item : line) : [...itemsRef.current, item]);
    }
  }), [commit, load, run]);

  const updateQuantity = useCallback((key: string, quantity: number) => run(async (owner, epoch) => {
    const item = itemsRef.current.find(line => line.key === key);
    if (!item) throw new Error('Sản phẩm không còn trong giỏ hàng. Hãy tải lại giỏ.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10
      || (quantity > item.maxAvailable && quantity >= item.quantity)) {
      throw new Error('Số lượng vượt quá tồn kho hoặc không hợp lệ.');
    }
    if (owner) { await setCartQuantity(key, quantity); await load(owner, epoch); }
    else commit(itemsRef.current.map(line => line.key === key ? { ...line, quantity } : line));
  }), [commit, load, run]);

  const removeItem = useCallback((key: string) => run(async (owner, epoch) => {
    if (owner) { await removeFromCart(key); await load(owner, epoch); }
    else commit(itemsRef.current.filter(item => item.key !== key));
  }), [commit, load, run]);

  const clearCart = useCallback(() => run(async (owner, epoch) => {
    if (owner) { await clearServerCart(); await load(owner, epoch); }
    else commit([]);
  }), [commit, load, run]);

  const toggleSelectItem = useCallback((key: string) => {
    setSelectedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }, []);

  const toggleSelectAll = useCallback((selected?: boolean) => {
    setSelectedKeys(prev => {
      const allKeys = itemsRef.current.map(i => i.key);
      const shouldSelect = selected !== undefined ? selected : prev.length < allKeys.length;
      return shouldSelect ? allKeys : [];
    });
  }, []);

  const submitOrder = useCallback((customer: Customer) => run(async (owner, epoch) => {
    if (!owner) throw new ApiError('NOT_CONFIGURED', 'Đặt hàng cần kết nối Supabase');
    await load(owner, epoch);
    if (epochRef.current !== epoch) throw new Error('Tài khoản đã thay đổi.');
    const activeSelected = itemsRef.current.filter(item => selectedKeysRef.current.includes(item.key));
    const orderItems = activeSelected.length > 0 ? activeSelected : itemsRef.current;
    validateOrderItems(orderItems);
    const fulfillmentType = customer.fulfillmentType ?? (customer.deliveryAddress ? 'delivery' : 'pickup');
    const idempotencyKey = customer.idempotencyKey ?? `idemp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const result = await placeOrder({
      customerName: customer.customerName,
      customerPhone: customer.customerPhone,
      fulfillmentType,
      idempotencyKey,
      branchId: fulfillmentType === 'pickup' ? (customer.branchId ?? orderItems[0].branchId) : undefined,
      deliveryAddress: fulfillmentType === 'delivery' ? customer.deliveryAddress : undefined,
      voucherCode: customer.voucherCode,
      note: customer.note,
      items: orderItems.map(item => ({ variantId: item.skuId, quantity: item.quantity })),
    });
    if (epochRef.current === epoch && mountedRef.current) commit([]);
    // place_order already clears the purchased rows atomically; never delete them a second time.
    // A refresh failure after a successful order must not encourage resubmitting the order.
    try { await load(owner, epoch); } catch (e) {
      if (mountedRef.current && epochRef.current === epoch) setError(cartErrorMessage(e));
    }
    return result;
  }), [commit, load, run]);

  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalVnd = items.reduce((sum, item) => sum + item.unitPriceVnd * item.quantity, 0);
  const selectedItems = items.filter(item => selectedKeys.includes(item.key));
  const selectedCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const selectedTotalVnd = selectedItems.reduce((sum, item) => sum + item.unitPriceVnd * item.quantity, 0);

  return <CartContext.Provider value={{ items, count, totalVnd, selectedKeys, selectedItems, selectedCount, selectedTotalVnd,
    loading, error, userId, branches, branchId, refresh, selectBranch, addItem, updateQuantity, removeItem,
    clearCart, toggleSelectItem, toggleSelectAll, submitOrder }}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
