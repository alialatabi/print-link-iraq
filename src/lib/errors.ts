/**
 * Maps raw database/API errors to user-friendly Arabic messages.
 * Prevents leaking internal schema details to end users.
 */
export function getUserFriendlyError(error: any): string {
  const message = (error?.message || '').toLowerCase();

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
