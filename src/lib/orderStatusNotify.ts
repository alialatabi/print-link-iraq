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
