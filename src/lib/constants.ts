/**
 * Shared label/color maps and constant arrays used across admin pages.
 *
 * Extracted from inline definitions in AdminPanel.tsx and AdminAccounts.tsx
 * during Phase 1.2 of the refactor plan.
 *
 * STATUS_LABELS and OrderStatus remain canonical in `@/data/mockData` (they
 * are also re-exported here for callers that prefer a single constants import).
 */

export { STATUS_LABELS } from '@/data/mockData';
export type { OrderStatus } from '@/data/mockData';
export type { OrderStatus as OrderStatusType } from '@/data/mockData';

import type { OrderStatus } from '@/data/mockData';

// ─── Order status list (canonical ordered array used by select dropdowns) ───

export const ORDER_STATUSES: OrderStatus[] = [
  'draft', 'submitted', 'assigned', 'design_uploaded',
  'waiting_approval', 'approved', 'print_ready', 'printed', 'delivered', 'cancelled',
];

// ─── Role labels ─────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  customer: 'زبون',
  designer: 'مصمم',
  admin: 'أدمن',
};

// ─── Payment labels & colors (AdminAccounts) ─────────────────────────────────

export const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'غير مدفوع',
  partial: 'جزئي',
  paid: 'مدفوع',
};

export const PAYMENT_COLORS: Record<string, string> = {
  unpaid: 'bg-destructive/10 text-destructive border-destructive/20',
  partial: 'bg-accent/15 text-accent-foreground border-accent/30',
  paid: 'bg-success/10 text-success border-success/20',
};

// ─── Date-range type + labels (AdminAccounts) ─────────────────────────────────

export type DateRange = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';

export const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: 'اليوم',
  week: 'هذا الأسبوع',
  month: 'هذا الشهر',
  quarter: 'آخر 3 أشهر',
  year: 'هذه السنة',
  all: 'الكل',
};
