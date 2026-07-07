import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import type { AiCartPayload } from '@/lib/aiDesign';
import type { CartVariantInfo, VariantTier } from '@/types/variants';
import { useAuth } from '@/contexts/AuthContext';
import { mergeCarts, sanitizeCartItems } from '@/lib/cartMerge';
import { loadServerCart, saveServerCart, deleteServerCart } from '@/lib/cartSync';

export interface CartItem {
  /**
   * Stable identity for this cart line (see `computeLineId` below). Legacy
   * (non-variant) lines: === templateId — every pre-existing call site already
   * keys off templateId, so this is a pure back-compat alias. Variant lines:
   * templateId + variant + attribute choices, so different sizes/attribute
   * combos of the same template are distinct lines while re-picking a
   * different TIER of the same configuration stays the same line (tier is
   * mutable via `updateTier`, not part of line identity).
   */
  lineId: string;
  templateId: string;
  templateName: string;
  serviceType: string;
  previewUrl: string | null;
  quantity: number;
  unitPrice: number; // price per minQuantity
  minQuantity: number; // minimum order quantity for this service
  cellophane?: string; // 'matte' | 'glossy' | '' (none)
  /** Present for variant-tier lines (size/shape + admin-priced tier + attribute choices). */
  variant?: CartVariantInfo;
  /** Discount percent (0–100) applied to the variant tier's charged price, if any. */
  discountPct?: number;
  /** Present when this is an AI-designed item (priced at AI_DESIGN_FEE, fixed qty 1). */
  aiDesign?: AiCartPayload;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'lineId'>) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateTier: (lineId: string, tier: VariantTier, discountPct?: number) => void;
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

/** `attrId:value` pairs, sorted, joined by ',' — the attribute-choice component of a variant lineId. */
function attrKey(attributes: CartVariantInfo['attributes']): string {
  if (!attributes) return '';
  return Object.entries(attributes)
    .map(([id, v]) => `${id}:${v.value}`)
    .sort()
    .join(',');
}

/**
 * Legacy line: lineId === templateId (back-compat). Variant line: templateId
 * + variantId + attribute choices — a different size/shape/attribute combo is
 * a distinct line, but re-picking a different TIER of the same variant stays
 * the same line since tier is not part of identity (see CartItem.lineId).
 */
function computeLineId(templateId: string, variant?: CartVariantInfo): string {
  if (!variant) return templateId;
  return `${templateId}::${variant.variantId}::${attrKey(variant.attributes)}`;
}

/**
 * Back-compat for items persisted before `lineId` existed: derive one on the
 * fly. Returns null (dropped by the caller) for anything that isn't a plain
 * object — never throws, so a foreign/malformed localStorage entry can't
 * crash the provider (e.g. `totalPrice` reading `.unitPrice` off it).
 */
function withLineId(raw: unknown): CartItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as CartItem;
  if (item.lineId) return item;
  return { ...item, lineId: computeLineId(item.templateId, item.variant) };
}

export const CartProvider = ({ children }: { children: ReactNode }) => {
  // Consume (never mutate) auth. We only sync while a user is logged in and auth has settled.
  const { user, loading } = useAuth();

  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed)
        ? parsed.map(withLineId).filter((i): i is CartItem => i !== null)
        : [];
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
        // sanitizeCartItems doesn't carry `lineId` (it's a client-derived identity, not part of the
        // untrusted server payload) — re-derive it for any server-only items via `withLineId`, same
        // as the localStorage-hydration back-compat path above.
        const merged = mergeCarts(itemsRef.current, serverItems)
          .map(withLineId)
          .filter((i): i is CartItem => i !== null);
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

  const addItem = (item: Omit<CartItem, 'lineId'>) => {
    const lineId = computeLineId(item.templateId, item.variant);
    setItems(prev => {
      const existing = prev.find(i => i.lineId === lineId);
      if (!existing) return [...prev, { ...item, lineId }];
      if (!item.variant) {
        // Legacy path — UNCHANGED behavior: only quantity is replaced, every
        // other field is preserved from the existing line.
        return prev.map(i => (i.lineId === lineId ? { ...i, quantity: item.quantity } : i));
      }
      // Variant path: re-adding the same product configuration (variant +
      // attributes) — typically picking a different tier — replaces the whole
      // line, since quantity/unitPrice/variant.tier* all change together.
      return prev.map(i => (i.lineId === lineId ? { ...item, lineId } : i));
    });
  };

  const removeItem = (lineId: string) => {
    setItems(prev => prev.filter(i => i.lineId !== lineId));
  };

  const updateQuantity = (lineId: string, quantity: number) => {
    const item = items.find(i => i.lineId === lineId);
    if (item?.variant) return; // variant lines change qty via updateTier, not updateQuantity
    const minQ = item?.minQuantity || 1000;
    if (quantity < minQ) return;
    setItems(prev =>
      prev.map(i => (i.lineId === lineId ? { ...i, quantity } : i))
    );
  };

  /** Recompute a variant line's quantity/minQuantity/unitPrice + variant.tier* for a newly-picked tier. */
  const updateTier = (lineId: string, tier: VariantTier, discountPct?: number) => {
    setItems(prev => prev.map(i => {
      if (i.lineId !== lineId || !i.variant) return i;
      const pct = discountPct !== undefined ? discountPct : (i.discountPct ?? 0);
      const unitPrice = pct > 0 ? Math.round(tier.price * (1 - pct / 100)) : tier.price;
      return {
        ...i,
        quantity: tier.qty,
        minQuantity: tier.qty,
        unitPrice,
        discountPct: discountPct !== undefined ? discountPct : i.discountPct,
        variant: {
          ...i.variant,
          tierQty: tier.qty,
          tierPrice: tier.price,
          gift: tier.gift,
          tierCost: tier.cost,
        },
      };
    }));
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
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, updateTier, clearCart, totalPrice, itemCount }}>
      {children}
    </CartContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- standard React context pattern: hook + provider in one file
export const useCart = () => useContext(CartContext);
