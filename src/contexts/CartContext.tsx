import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AiCartPayload } from '@/lib/aiDesign';

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

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

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

  const clearCart = () => setItems([]);

  const totalPrice = items.reduce((sum, i) => sum + Math.ceil(i.unitPrice * (i.quantity / (i.minQuantity || 1000))), 0);
  const itemCount = items.length;

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalPrice, itemCount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
