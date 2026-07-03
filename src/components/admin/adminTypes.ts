/**
 * Shared local interfaces for AdminPanel and its extracted child tab components.
 * Keep in sync with the query shapes in AdminPanel.tsx.
 */
import type { OrderDetailsJson } from '@/types/db';
import type { AiFieldsValue } from '@/components/admin/AiFieldsEditor';

// ─── AdminServicesSpecs types ────────────────────────────────────────────────

export interface Service {
  id: string;
  label: string;
  icon: string;
  icon_url: string | null;
  description: string;
  sort_order: number;
  price: number;
  cost: number;
  parent_id: string | null;
  completion_days: number;
  min_quantity?: number;
  cellophane_type?: string;
  print_enabled?: boolean;
  ai_enabled?: boolean;
  ai_fee?: number;
  /** Printed faces per design version: 1 = single, 2 = front + back. */
  faces?: number;
  ai_canvas?: string | null;
  ai_size_label?: string | null;
  ai_option_label?: string | null;
  ai_options?: unknown;
  ai_custom_size?: unknown;
  ai_directives?: string | null;
}

export interface Specialization {
  id: string;
  label: string;
  icon: string;
  icon_url: string | null;
  sort_order: number;
}

export interface ServiceFormState {
  id: string;
  label: string;
  icon: string;
  description: string;
  price: number;
  cost: number;
  parent_id: string;
  completion_days: number;
  min_quantity: number;
  cellophane_type: string;
  print_enabled: boolean;
  ai_enabled: boolean;
  ai_fee: number;
  /** Printed faces per design version: 1 = single, 2 = front + back (two-face products). */
  faces: 1 | 2;
  aiFields: AiFieldsValue;
}

export interface AdminOrder {
  id: string;
  customer_id: string;
  designer_id: string | null;
  status: string;
  paid_amount: number;
  payment_status: string;
  created_at: string;
  details: OrderDetailsJson;
  templates: { name: string; service_type: string } | null;
  profiles: { display_name: string | null; phone: string | null } | null;
  _items: AdminOrderItem[];
  _designs: AdminDesign[];
}

export interface AdminOrderItem {
  id: string;
  order_id: string;
  status: string | null;
  details: OrderDetailsJson;
  template_id: string | null;
  templates: { name: string; service_type: string } | null;
}

export interface AdminDesign {
  id: string;
  order_id: string;
  order_item_id: string | null;
  version: number;
  file_url: string;
  approved: boolean | null;
  /** Two-face products only: 'front' | 'back'. NULL for single-face designs. */
  face?: 'front' | 'back' | null;
}

export interface DesignerProfile {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  is_active: boolean;
  last_seen: string | null;
}

export interface AdminUser {
  user_id: string;
  display_name: string | null;
  phone: string | null;
  is_super_admin: boolean;
  roles: string[];
}

export type QuickFilter = 'all' | 'pending' | 'inprogress' | 'completed' | null;

export interface DesignerWorkloadItem extends DesignerProfile {
  activeOrders: number;
  totalOrders: number;
  completedOrders: number;
}
