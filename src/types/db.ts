/**
 * Convenient type aliases over the generated Supabase schema types.
 * Import from here instead of reaching into @/integrations/supabase/types directly.
 */
import type { Database } from '@/integrations/supabase/types';

export type OrderRow        = Database['public']['Tables']['orders']['Row'];
export type ProfileRow      = Database['public']['Tables']['profiles']['Row'];
export type OrderItemRow    = Database['public']['Tables']['order_items']['Row'];
export type UserRoleRow     = Database['public']['Tables']['user_roles']['Row'];
export type ServiceRow      = Database['public']['Tables']['services']['Row'];
export type OrderStatusEnum = Database['public']['Enums']['order_status'];
export type AppRole         = Database['public']['Enums']['app_role'];

/**
 * The `details` JSON column is free-form and varies by order_type / code path.
 * A structured union would be accurate but is out of scope for this refactor pass.
 * This is the single intentional `any` in non-admin code — all other `any` usages
 * import this alias rather than writing `any` directly.
 *
 * eslint-disable-next-line @typescript-eslint/no-explicit-any -- free-form order JSON
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OrderDetailsJson = any;
