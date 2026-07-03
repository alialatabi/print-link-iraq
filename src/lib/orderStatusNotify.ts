import { supabase } from '@/integrations/supabase/client';

// Shared order-status push copy + sender. Extracted from AdminPanel so BOTH the admin
// status-change flow AND the designer flow (send-for-approval, reseller review, send-to-print)
// notify the customer through the same code path. Fires the `send-push` edge function
// best-effort — it never blocks or throws, so a failed push can't break a status update.

/**
 * Customer-facing push copy per order status (Arabic). Only these statuses notify the
 * customer; internal/among-staff statuses (draft, submitted, assigned, design_uploaded)
 * stay silent. Keyed by a logical event name — for most keys it matches the DB order
 * status, except `revision`, a logical key used when a designer sends edits back to the
 * customer (the DB status returns to `assigned`, which must NOT notify on its own because
 * an admin assigning a designer also writes `assigned`).
 */
export const STATUS_PUSH: Partial<Record<string, { title: string; body: string }>> = {
  waiting_approval: { title: 'تصميمك جاهز ✨', body: 'صار تصميم طلبك جاهز للمراجعة — افتح التطبيق للموافقة' },
  approved: { title: 'تمت الموافقة ✅', body: 'تمت الموافقة على طلبك وراح يدخل مرحلة الطباعة' },
  revision: { title: 'مطلوب تعديل ✍️', body: 'المصمم طلب تعديلات على تصميمك — افتح التطبيق لمراجعة الملاحظات' },
  print_ready: { title: 'جاهز للطباعة 🖨️', body: 'طلبك جاهز للطباعة' },
  printed: { title: 'تمت الطباعة 🖨️', body: 'تمت طباعة طلبك ويتم تجهيزه للتوصيل' },
  delivered: { title: 'تم التسليم 🎉', body: 'تم تسليم طلبك. شكراً لاختيارك مطبعتي' },
  cancelled: { title: 'تم إلغاء الطلب', body: 'تم إلغاء طلبك. لأي استفسار تواصل معنا' },
};

/**
 * Best-effort push to the customer about their order status. Never blocks or throws
 * (push is non-critical). No-ops when the customer id is missing or the status/event
 * key has no customer-facing copy in STATUS_PUSH.
 *
 * @param orderId    the order the push deep-links to (`/track-order/:orderId`)
 * @param customerId recipient user id (usually `order.customer_id`)
 * @param status     order status or logical event key (see STATUS_PUSH)
 */
export function notifyOrderStatusPush(
  orderId: string | null | undefined,
  customerId: string | null | undefined,
  status: string,
): void {
  const msg = STATUS_PUSH[status];
  if (!orderId || !customerId || !msg) return;
  supabase.functions
    .invoke('send-push', {
      body: { userId: customerId, title: msg.title, body: msg.body, data: { orderId, status } },
    })
    .catch(() => { /* push is non-critical */ });
}

/**
 * Designer-facing push copy for customer actions on a design (Arabic). Kept as a
 * SEPARATE map from STATUS_PUSH — that one is strictly the customer-facing set and
 * is asserted key-for-key in tests. Keyed by the logical customer action, not a DB
 * status ('revision' writes the item back to `assigned`, which must stay silent).
 */
export const CUSTOMER_ACTION_PUSH: Record<'approved' | 'revision', { title: string; body: string }> = {
  approved: { title: 'وافق الزبون على التصميم ✅', body: 'يمكنك الآن إرساله للطباعة' },
  revision: { title: 'الزبون طلب تعديلاً ✍️', body: 'افتح الطلب لقراءة الملاحظات' },
};

export type CustomerAction = keyof typeof CUSTOMER_ACTION_PUSH;

/**
 * Best-effort push to the assigned designer when the customer acts on a design in
 * OrderTracking (approves it or requests a revision) — the reverse direction of
 * notifyOrderStatusPush. Never blocks or throws (push is non-critical), and no-ops
 * when the order has no assigned designer yet (`designer_id` NULL).
 *
 * The send-push edge function authorizes this direction server-side: a non-staff
 * caller may only target the designers of their own orders.
 *
 * @param orderId    the order the push deep-links to (`data.orderId`)
 * @param designerId recipient user id (`order.designer_id`)
 * @param action     what the customer did: 'approved' | 'revision'
 */
export function notifyDesignerOfCustomerAction(
  orderId: string | null | undefined,
  designerId: string | null | undefined,
  action: CustomerAction,
): void {
  const msg = CUSTOMER_ACTION_PUSH[action];
  if (!orderId || !designerId || !msg) return;
  supabase.functions
    .invoke('send-push', {
      body: { userId: designerId, title: msg.title, body: msg.body, data: { orderId, action } },
    })
    .catch(() => { /* push is non-critical */ });
}

/**
 * Customer-facing push copy when the DESIGNER asks the customer a clarifying question about
 * their order (the "اطلب توضيحاً من الزبون" action on DesignerOrderDetails). Kept SEPARATE from
 * STATUS_PUSH — that map is strictly the order-STATUS set and is asserted key-for-key in tests;
 * a clarification is not a status change (the order status stays put).
 */
export const CLARIFICATION_PUSH = {
  title: 'المصمم يحتاج توضيحاً منك 💬',
  body: 'افتح الطلب للرد على سؤال المصمم',
} as const;

/**
 * Best-effort push to the customer when the designer requests a clarification. Never blocks or
 * throws (push is non-critical) and no-ops when the order/customer id is missing. Staff→customer
 * pushes are authorized server-side in the `send-push` edge function (a customer of some order is
 * always a valid target), so no function change is needed.
 *
 * @param orderId    the order the push deep-links to (`data.orderId`)
 * @param customerId recipient user id (`order.customer_id`)
 */
export function notifyCustomerOfClarification(
  orderId: string | null | undefined,
  customerId: string | null | undefined,
): void {
  if (!orderId || !customerId) return;
  supabase.functions
    .invoke('send-push', {
      body: {
        userId: customerId,
        title: CLARIFICATION_PUSH.title,
        body: CLARIFICATION_PUSH.body,
        data: { orderId, event: 'clarification' },
      },
    })
    .catch(() => { /* push is non-critical */ });
}
