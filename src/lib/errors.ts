/**
 * Maps raw database/API errors to user-friendly Arabic messages.
 * Prevents leaking internal schema details to end users.
 *
 * Two functions are exported:
 *  - `getUserFriendlyError` — maps error message text (existing, broad use)
 *  - `handleSupabaseError`  — maps PostgreSQL error codes + message text (Phase 1.2+)
 */

/**
 * Map a Supabase/PostgreSQL error to a concise user-facing Arabic string.
 *
 * Priority:
 *  1. PostgreSQL error code (err.code) — covers duplicate-key, RLS, etc.
 *  2. Message text containing RLS/permission keywords.
 *  3. The raw error message (preserves any server-crafted Arabic message).
 *  4. Generic fallback.
 *
 * Only adopt in catch blocks that already show a GENERIC Arabic fallback
 * (`err.message || 'حدث خطأ'`-style). Do NOT replace tailored per-action messages.
 */
export function handleSupabaseError(err: unknown): string {
  if (!err) return 'حدث خطأ غير متوقع';

  const code = (err as { code?: string })?.code;

  // PostgreSQL error codes
  if (code === '23505') return 'البيانات موجودة مسبقاً';
  if (code === '42501' || code === 'PGRST301') return 'ليس لديك الصلاحية';

  const message = ((err as { message?: string })?.message || '').toLowerCase();

  // RLS / permission errors by message text
  if (
    message.includes('row-level security') ||
    message.includes('permission denied') ||
    message.includes('jwt')
  ) {
    return 'ليس لديك الصلاحية';
  }

  // Return the raw message (may already be Arabic from edge functions), or a generic fallback.
  return (err as { message?: string })?.message || 'حدث خطأ غير متوقع';
}

export function getUserFriendlyError(error: unknown): string {
  const message = ((error as { message?: string })?.message || '').toLowerCase();

  if (message.includes('duplicate key')) {
    return 'هذا العنصر موجود مسبقاً';
  }
  if (message.includes('foreign key')) {
    return 'العنصر المرتبط غير موجود';
  }
  if (message.includes('row-level security')) {
    return 'ليس لديك صلاحية لهذا الإجراء';
  }
  if (message.includes('not null') || message.includes('not-null')) {
    return 'يرجى ملء جميع الحقول المطلوبة';
  }
  if (message.includes('check constraint')) {
    return 'البيانات المدخلة غير صالحة';
  }
  if (message.includes('timeout') || message.includes('timed out')) {
    return 'انتهت مهلة الاتصال، حاول مرة أخرى';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'خطأ في الاتصال بالشبكة';
  }
  if (message.includes('storage') && message.includes('size')) {
    return 'حجم الملف كبير جداً';
  }

  console.error('Unhandled error:', error);
  return 'حدث خطأ، يرجى المحاولة مرة أخرى';
}
