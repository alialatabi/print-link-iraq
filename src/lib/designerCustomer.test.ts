import { describe, it, expect } from 'vitest';
import { resolveDetailsPhone } from './designerCustomer';

describe('resolveDetailsPhone', () => {
  it('prefers the delivery phone', () => {
    expect(resolveDetailsPhone({ delivery_phone: '0770', phone: '0781', customer_phone: '0788' })).toBe('0770');
  });

  it('falls back through customer_phone → phone → shop_phone', () => {
    expect(resolveDetailsPhone({ customer_phone: '0788' })).toBe('0788');
    expect(resolveDetailsPhone({ phone: '0781' })).toBe('0781');
    expect(resolveDetailsPhone({ shop_phone: '0755' })).toBe('0755');
  });

  it('trims and ignores blank / non-string values', () => {
    expect(resolveDetailsPhone({ delivery_phone: '  0770  ' })).toBe('0770');
    expect(resolveDetailsPhone({ delivery_phone: '   ', phone: '0781' })).toBe('0781');
    expect(resolveDetailsPhone({ delivery_phone: 12345, phone: '0781' })).toBe('0781');
  });

  it('returns null when nothing usable is present', () => {
    expect(resolveDetailsPhone({})).toBeNull();
    expect(resolveDetailsPhone(null)).toBeNull();
    expect(resolveDetailsPhone(undefined)).toBeNull();
  });
});
