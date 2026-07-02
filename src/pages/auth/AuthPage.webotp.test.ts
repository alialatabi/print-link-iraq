/**
 * Tests for extractWebOtpCode (WebOTP auto-fill helper exported from AuthPage).
 *
 * Android Chrome resolves navigator.credentials.get({ otp: { transport: ['sms'] } })
 * with an OTPCredential carrying `code` when the verification SMS ends with the
 * origin-bound line "@matbaty.com #123456". The helper must accept exactly a
 * 6-digit numeric string and reject everything else (the OTP inputs and the
 * verify-otp call both assume 6 digits).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', async () => {
  const { mockSupabase } = await import('@/test/mocks/supabase');
  return { supabase: mockSupabase };
});

// Import AFTER the mock is registered (AuthPage pulls in the supabase client).
import { extractWebOtpCode } from './AuthPage';

describe('extractWebOtpCode', () => {
  it('returns the code for a credential with a 6-digit string code', () => {
    expect(extractWebOtpCode({ code: '123456' })).toBe('123456');
    expect(extractWebOtpCode({ code: '000000' })).toBe('000000');
    // Extra credential fields (id, type, ...) are fine — only `code` matters.
    expect(extractWebOtpCode({ id: '', type: 'otp', code: '987654' })).toBe('987654');
  });

  it('returns null when the credential is absent (user dismissed the prompt)', () => {
    expect(extractWebOtpCode(null)).toBeNull();
    expect(extractWebOtpCode(undefined)).toBeNull();
  });

  it('returns null when code is missing or not a string', () => {
    expect(extractWebOtpCode({})).toBeNull();
    expect(extractWebOtpCode({ code: 123456 })).toBeNull();
    expect(extractWebOtpCode({ code: null })).toBeNull();
    expect(extractWebOtpCode('123456')).toBeNull();
  });

  it('returns null for anything that is not exactly 6 ASCII digits', () => {
    expect(extractWebOtpCode({ code: '' })).toBeNull();
    expect(extractWebOtpCode({ code: '12345' })).toBeNull();
    expect(extractWebOtpCode({ code: '1234567' })).toBeNull();
    expect(extractWebOtpCode({ code: '12a456' })).toBeNull();
    expect(extractWebOtpCode({ code: ' 123456' })).toBeNull();
    expect(extractWebOtpCode({ code: '123456\n' })).toBeNull();
    expect(extractWebOtpCode({ code: '١٢٣٤٥٦' })).toBeNull(); // Arabic-Indic digits
  });
});
