import { OrderStatus } from '@/data/mockData';

/**
 * Reseller orders are tracked with a simplified 3-stage flow layered on top of the
 * existing order_status values:
 *   0) مراجعة التصميم  — we review the uploaded design
 *   1) طباعة           — printing
 *   2) سلّم لشركة التوصيل — handed to the shipping company
 */
export interface ResellerStage {
  key: string;
  label: string;
}

export const RESELLER_STAGES: ResellerStage[] = [
  { key: 'review', label: 'مراجعة التصميم' },
  { key: 'printing', label: 'طباعة' },
  { key: 'shipped', label: 'سلّم لشركة التوصيل' },
];

/** Map a raw order_status to a 0-based reseller stage index. Returns -1 for cancelled. */
export function resellerStageIndex(status: OrderStatus | string): number {
  switch (status) {
    case 'cancelled':
      return -1;
    case 'approved':
    case 'print_ready':
    case 'printed':
      return 1;
    case 'delivered':
      return 2;
    // submitted, assigned, design_uploaded, waiting_approval, draft → review
    default:
      return 0;
  }
}

export function isCancelled(status: OrderStatus | string): boolean {
  return status === 'cancelled';
}
