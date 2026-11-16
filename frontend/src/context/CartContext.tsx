import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { addToCart, getCart, removeFromCart, setCartQuantity, clearServerCart } from '../api/cartApi';
import { placeCartOrder } from '../api/orderApi';
import { ApiError, friendlyMessage } from '../api/errors';
import type { PlaceOrderResult } from '../api/types';
import { supabase } from '../lib/supabase';
import { uuidv4 } from '../lib/uuid';
import { getCatalog } from '../services/catalog-service';
import { variantPurchaseLimit } from '../services/product-purchase';
import { hydrateCart, lineLimit, validateOrderItems } from '../services/cart-adapter';
import { cartItemKey, type Branch, type CartItem } from '../types/shop';

type ItemDraft = Omit<CartItem, 'key' | 'quantity' | 'branchId' | 'branchName' | 'maxAvailable' | 'bestAvailable'>;
export type CartOrderInput = {
  customerName: string;
  customerPhone: string;
  fulfillmentType?: 'pickup' | 'delivery';
  branchId?: string;
  deliveryAddress?: string;
  voucherCode?: string;
  note?: string;
  /** uuid created once per checkout attempt and re-sent on retry */
  idempotencyKey?: string;
  /** Cart lines to order; defaults to the current selection. */
  keys?: string[];
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
  removeItems: (keys: string[]) => Promise<void>;
  clearCart: () => Promise<void>;
  toggleSelectItem: (key: string) => void;
  toggleSelectAll: (selected?: boolean) => void;
  submitOrder: (input: CartOrderInput) => Promise<PlaceOrderResult>;
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
  const itemsRef = useRef<CartItem[]>([]);
  const selectedKeysRef = useRef<string[]>([]);
  const branchRef = useRef('');
  const ownerRef = useRef<string | null>(null);
  const epochRef = useRef(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  const select = useCallback((next: string[]) => {
    selectedKeysRef.current = next;
    setSelectedKeys(next);
  }, []);

  /** New lines start selected, removed lines drop out, and the customer's other choices are kept. */
  const commit = useCallback((next: CartItem[]) => {
    const previousKeys = new Set(itemsRef.current.map(item => item.key));
    const chosen = new Set(selectedKeysRef.current);
    itemsRef.current = next;
    setItems(next);
    select(next.filter(item => chosen.has(item.key) || !previousKeys.has(item.key)).map(item => item.key));
  }, [select]);

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
      itemsRef.current = [];
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
      const previous = itemsRef.current;
      const selected = new Set(selectedKeysRef.current);
      const next = previous.map(item => ({ ...item, key: cartItemKey(item.skuId, id), branchId: id, branchName: branch.name,
        maxAvailable: Math.min(10, Math.max(0, catalog.stock.find(row => row.skuId === item.skuId && row.branchId === id)?.quantity ?? 0)) }));
      // Guest keys contain the branch: carry the selection across the rename.
      itemsRef.current = next;
      setItems(next);
      select(next.filter((_, index) => selected.has(previous[index].key)).map(item => item.key));
    }
  }), [load, run, select]);

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
        quantity: existing + quantity, bestAvailable: limit, maxAvailable: Math.min(10, Math.max(0,
          catalog.stock.find(row => row.skuId === draft.skuId && row.branchId === branch.id)?.quantity ?? 0)) };
      commit(existing ? itemsRef.current.map(line => line.skuId === draft.skuId ? item : line) : [...itemsRef.current, item]);
    }
  }), [commit, load, run]);

  const updateQuantity = useCallback((key: string, quantity: number) => run(async (owner, epoch) => {
    const item = itemsRef.current.find(line => line.key === key);
    if (!item) throw new Error('Sản phẩm không còn trong giỏ hàng. Hãy tải lại giỏ.');
    // Lowering is always allowed (so an over-stock line can be fixed); raising must stay within stock.
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10 || (quantity > item.quantity && quantity > lineLimit(item))) {
      throw new Error('Số lượng vượt quá tồn kho hoặc không hợp lệ.');
    }
    if (owner) { await setCartQuantity(key, quantity); await load(owner, epoch); }
    else commit(itemsRef.current.map(line => line.key === key ? { ...line, quantity } : line));
  }), [commit, load, run]);

  const removeItems = useCallback((keys: string[]) => run(async (owner, epoch) => {
    if (owner) { for (const key of keys) await removeFromCart(key); await load(owner, epoch); }
    else commit(itemsRef.current.filter(item => !keys.includes(item.key)));
  }), [commit, load, run]);
  const removeItem = useCallback((key: string) => removeItems([key]), [removeItems]);

  const clearCart = useCallback(() => run(async (owner, epoch) => {
    if (owner) { await clearServerCart(); await load(owner, epoch); }
    else commit([]);
  }), [commit, load, run]);

  const toggleSelectItem = useCallback((key: string) => {
    const current = selectedKeysRef.current;
    select(current.includes(key) ? current.filter(k => k !== key) : [...current, key]);
  }, [select]);

  const toggleSelectAll = useCallback((selected?: boolean) => {
    const allKeys = itemsRef.current.map(i => i.key);
    const shouldSelect = selected !== undefined ? selected : selectedKeysRef.current.length < allKeys.length;
    select(shouldSelect ? allKeys : []);
  }, [select]);

  const submitOrder = useCallback((input: CartOrderInput) => run(async (owner, epoch) => {
    if (!owner) throw new ApiError('NOT_CONFIGURED', 'Đặt hàng cần kết nối Supabase');
    const keys = input.keys ?? selectedKeysRef.current;
    await load(owner, epoch);
    if (epochRef.current !== epoch) throw new Error('Tài khoản đã thay đổi.');
    const orderItems = itemsRef.current.filter(item => keys.includes(item.key));
    if (orderItems.length !== new Set(keys).size) throw new Error('Giỏ hàng vừa thay đổi. Vui lòng kiểm tra lại trước khi đặt.');
    validateOrderItems(orderItems);
    const fulfillmentType = input.fulfillmentType ?? (input.deliveryAddress ? 'delivery' : 'pickup');
    const pickupBranch = input.branchId ?? branchRef.current;
    if (fulfillmentType === 'pickup' && !pickupBranch) throw new Error('Vui lòng chọn cửa hàng nhận hàng.');
    const result = await placeCartOrder({
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      fulfillmentType,
      idempotencyKey: input.idempotencyKey ?? uuidv4(),
      branchId: fulfillmentType === 'pickup' ? pickupBranch : undefined,
      deliveryAddress: fulfillmentType === 'delivery' ? input.deliveryAddress : undefined,
      voucherCode: input.voucherCode || undefined,
      note: input.note,
      items: orderItems.map(item => ({ variantId: item.skuId, quantity: item.quantity })),
    });
    // place_cart_order removed exactly these rows on the server; mirror that before refreshing.
    const ordered = new Set(orderItems.map(item => item.key));
    if (epochRef.current === epoch && mountedRef.current) commit(itemsRef.current.filter(item => !ordered.has(item.key)));
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
    loading, error, userId, branches, branchId, refresh, selectBranch, addItem, updateQuantity, removeItem, removeItems,
    clearCart, toggleSelectItem, toggleSelectAll, submitOrder }}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
