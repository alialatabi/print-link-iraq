import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import type { AiCartPayload } from '@/lib/aiDesign';
import { useAuth } from '@/contexts/AuthContext';
import { mergeCarts, sanitizeCartItems } from '@/lib/cartMerge';
import { loadServerCart, saveServerCart, deleteServerCart } from '@/lib/cartSync';

export interface CartItem {
  templateId: string;
  templateName: string;
  serviceType: string;
  previewUrl: string | null;
  quantity: number;
  unitPrice: number; // price per minQuantity
  minQuantity: number; // minimum order quantity for this service
  cellophane?: string; // 'matte' | 'glossy' | '' (none)
  /** Present when this is an AI-designed item (priced at AI_DESIGN_FEE, fixed qty 1). */
  aiDesign?: AiCartPayload;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (templateId: string) => void;
  updateQuantity: (templateId: string, quantity: number) => void;
  clearCart: () => void;
  totalPrice: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType>({} as CartContextType);

const CART_KEY = 'matbaati_cart';
// Coalesce window for pushing the full cart to the server. Mutations update localStorage + the UI
// instantly; the server write is best-effort and debounced so e.g. tapping a quantity stepper
// doesn't fire an upsert per press.
const SYNC_DEBOUNCE_MS = 2000;

export const CartProvider = ({ children }: { children: ReactNode }) => {
  // Consume (never mutate) auth. We only sync while a user is logged in and auth has settled.
  const { user, loading } = useAuth();

  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // localStorage stays the source of truth for instant UX — persist on every change (unchanged).
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  // A fresh view of `items` for async callbacks that must not capture a stale closure.
  const itemsRef = useRef<CartItem[]>(items);
  itemsRef.current = items;
  // The user id whose server cart we've already merged in this session. Gates the debounced writer
  // so it can never fire before the one-time login merge completes. null = guest / not yet merged.
  const syncedUserIdRef = useRef<string | null>(null);

  // --- One-time server -> local merge on login --------------------------------
  // On auth ready + logged in, fetch the server cart ONCE and merge it into the local cart
  // (local wins on conflict), then write the merged result back to both stores. All server access
  // is resilient: any failure (including the table not existing pre-migration) behaves like an
  // empty server cart, so nothing here can break the cart for the user.
  useEffect(() => {
    if (loading) return;
    const userId = user?.id ?? null;
    if (!userId) {
      // Guest, or just logged out: keep localStorage exactly as-is and stop syncing.
      syncedUserIdRef.current = null;
      return;
    }
    if (syncedUserIdRef.current === userId) return;

    let cancelled = false;
    void (async () => {
      try {
        const serverItems = sanitizeCartItems(await loadServerCart(userId));
        if (cancelled) return;
        // Enable the debounced writer for this user BEFORE setItems triggers its re-run.
        syncedUserIdRef.current = userId;
        const merged = mergeCarts(itemsRef.current, serverItems);
        setItems(merged);
        void saveServerCart(userId, merged); // persist merged immediately (fire-and-forget)
      } catch {
        // Best-effort: on any unexpected failure keep localStorage as-is and leave syncing disabled
        // for this session (avoid clobbering a server cart we could not read).
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, loading]);

  // --- Debounced local -> server push on every change -------------------------
  // While logged in (and only after the initial merge), coalesce cart changes into a single upsert.
  // An empty cart deletes the server row so it reflects a truly-empty cart, not a stale one.
  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId || syncedUserIdRef.current !== userId) return; // guests + the pre-merge window never write
    const timer = setTimeout(() => {
      if (items.length === 0) void deleteServerCart(userId);
      else void saveServerCart(userId, items);
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [items, user?.id]);

  const addItem = (item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.templateId === item.templateId);
      if (existing) {
        return prev.map(i =>
          i.templateId === item.templateId
            ? { ...i, quantity: item.quantity }
            : i
        );
      }
      return [...prev, item];
    });
  };

  const removeItem = (templateId: string) => {
    setItems(prev => prev.filter(i => i.templateId !== templateId));
  };

  const updateQuantity = (templateId: string, quantity: number) => {
    const item = items.find(i => i.templateId === templateId);
    const minQ = item?.minQuantity || 1000;
    if (quantity < minQ) return;
    setItems(prev =>
      prev.map(i => (i.templateId === templateId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
    // Also drop the server row promptly (e.g. right after a successful order) — don't wait for the
    // debounce. Fire-and-forget + resilient, so a network/table error never blocks the UX.
    const userId = user?.id;
    if (userId) void deleteServerCart(userId);
  };

  const totalPrice = items.reduce((sum, i) => sum + Math.ceil(i.unitPrice * (i.quantity / (i.minQuantity || 1000))), 0);
  const itemCount = items.length;

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalPrice, itemCount }}>
      {children}
    </CartContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- standard React context pattern: hook + provider in one file
export const useCart = () => useContext(CartContext);
