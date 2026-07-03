import { describe, it, expect } from 'vitest';
import { evaluateDirectPrint, formatBytes, isImageUrl } from './designUtils';

describe('evaluateDirectPrint', () => {
  it('blocks entirely when the status does not allow work', () => {
    expect(
      evaluateDirectPrint({ canWork: false, isAiDesign: false, hasUploadedDesign: true, attachmentCount: 3 }),
    ).toEqual({ canDirectPrint: false, blockedAiDraft: false });
  });

  it('AI item with no uploaded final is blocked as an AI draft (attachments never count)', () => {
    expect(
      evaluateDirectPrint({ canWork: true, isAiDesign: true, hasUploadedDesign: false, attachmentCount: 2 }),
    ).toEqual({ canDirectPrint: false, blockedAiDraft: true });
  });

  it('AI item WITH an uploaded final can be printed', () => {
    expect(
      evaluateDirectPrint({ canWork: true, isAiDesign: true, hasUploadedDesign: true, attachmentCount: 0 }),
    ).toEqual({ canDirectPrint: true, blockedAiDraft: false });
  });

  it('non-AI item can be printed from a customer attachment alone', () => {
    expect(
      evaluateDirectPrint({ canWork: true, isAiDesign: false, hasUploadedDesign: false, attachmentCount: 1 }),
    ).toEqual({ canDirectPrint: true, blockedAiDraft: false });
  });

  it('non-AI item with neither upload nor attachment cannot be printed', () => {
    expect(
      evaluateDirectPrint({ canWork: true, isAiDesign: false, hasUploadedDesign: false, attachmentCount: 0 }),
    ).toEqual({ canDirectPrint: false, blockedAiDraft: false });
  });
});

describe('formatBytes', () => {
  it('formats bytes, KB and MB with sensible precision', () => {
    expect(formatBytes(512)).toBe('512B');
    expect(formatBytes(1024)).toBe('1.0KB');
    expect(formatBytes(2048)).toBe('2.0KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0MB');
    expect(formatBytes(Math.round(1.4 * 1024 * 1024))).toBe('1.4MB');
    expect(formatBytes(15 * 1024 * 1024)).toBe('15MB');
  });

  it('returns an empty string for invalid input', () => {
    expect(formatBytes(-5)).toBe('');
    expect(formatBytes(NaN)).toBe('');
  });
});

describe('isImageUrl (design paths)', () => {
  it('treats storage paths by extension', () => {
    expect(isImageUrl('orderId/itemId/v1.png')).toBe(true);
    expect(isImageUrl('orderId/itemId/v2.PDF')).toBe(false);
    expect(isImageUrl('orderId/order/v1.tif')).toBe(false);
  });
});
