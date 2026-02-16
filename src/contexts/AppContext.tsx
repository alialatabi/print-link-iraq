import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Order, MOCK_ORDERS } from '@/data/mockData';

interface AppState {
  orders: Order[];
  currentOrderId: string | null;
  isDesignerLoggedIn: boolean;
  isAdminLoggedIn: boolean;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setCurrentOrderId: (id: string | null) => void;
  setDesignerLoggedIn: (v: boolean) => void;
  setAdminLoggedIn: (v: boolean) => void;
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
}

const AppContext = createContext<AppState | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [isDesignerLoggedIn, setDesignerLoggedIn] = useState(false);
  const [isAdminLoggedIn, setAdminLoggedIn] = useState(false);

  const addOrder = (order: Order) => setOrders(prev => [order, ...prev]);
  const updateOrderStatus = (orderId: string, status: Order['status']) =>
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));

  return (
    <AppContext.Provider value={{
      orders, setOrders, currentOrderId, setCurrentOrderId,
      isDesignerLoggedIn, setDesignerLoggedIn,
      isAdminLoggedIn, setAdminLoggedIn,
      addOrder, updateOrderStatus,
    }}>
      {children}
    </AppContext.Provider>
  );
};
