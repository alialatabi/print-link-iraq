import React, { createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type OrderStatusType = Database['public']['Enums']['order_status'];

interface AppState {
  updateOrderStatus: (orderId: string, status: OrderStatusType) => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

// eslint-disable-next-line react-refresh/only-export-components -- standard React context pattern: hook + provider in one file
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const updateOrderStatus = async (orderId: string, status: OrderStatusType) => {
    await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);
  };

  return (
    <AppContext.Provider value={{ updateOrderStatus }}>
      {children}
    </AppContext.Provider>
  );
};
