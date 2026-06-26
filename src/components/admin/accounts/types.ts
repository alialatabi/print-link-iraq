/**
 * Shared types for AdminAccounts and its extracted child components.
 */
import type { OrderDetailsJson } from '@/types/db';

export interface OrderRow {
  id: string;
  customer_id: string;
  designer_id: string | null;
  status: string;
  paid_amount: number;
  payment_status: string;
  created_at: string;
  details: OrderDetailsJson;
  templates: {
    name: string;
    service_type: string;
  } | null;
  customer_name?: string;
  customer_phone?: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  status: string | null;
  details: OrderDetailsJson;
  template_id: string | null;
  templates: { service_type: string } | null;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  notes: string | null;
  expense_date: string;
  created_at: string;
  created_by: string;
}

// A fixed monthly commitment (rent, salaries…). Counted per-month in the P&L.
export interface RecurringExpense {
  id: string;
  title: string;
  amount: number;
  category: string;
  notes: string | null;
  active: boolean;
  created_at: string;
  created_by: string;
}

export type ExpenseForm = { title: string; amount: number; category: string; notes: string; expense_date: string };
export type RecurringForm = { title: string; amount: number; category: string; notes: string; active: boolean };

export type MonthlyTrendEntry = {
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  expenses: number;
  orders: number;
};

export type ServiceRevenueEntry = {
  key: string;
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  count: number;
  pending: number;
};

export type TopCustomerEntry = {
  name: string;
  total: number;
  count: number;
  paid: number;
};
