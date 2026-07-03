import { describe, it, expect } from 'vitest';
import {
  evaluateDirectPrint,
  formatBytes,
  isImageUrl,
  nextFaceUpload,
  latestVersionFaces,
  hasBothFaces,
  serviceFaceCount,
  type FaceDesignLike,
} from './designUtils';

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

  // ── Two-face (faces === 2) ──────────────────────────────────────────────────
  it('two-face item needs BOTH faces uploaded — one face alone cannot print', () => {
    expect(
      evaluateDirectPrint({ canWork: true, isAiDesign: false, hasUploadedDesign: true, attachmentCount: 0, faces: 2, bothFacesUploaded: false }),
    ).toEqual({ canDirectPrint: false, blockedAiDraft: false });
  });

  it('two-face item with BOTH faces uploaded can print', () => {
    expect(
      evaluateDirectPrint({ canWork: true, isAiDesign: false, hasUploadedDesign: true, attachmentCount: 0, faces: 2, bothFacesUploaded: true }),
    ).toEqual({ canDirectPrint: true, blockedAiDraft: false });
  });

  it('two-face item ignores customer attachments (two print files are required, never a draft)', () => {
    expect(
      evaluateDirectPrint({ canWork: true, isAiDesign: false, hasUploadedDesign: false, attachmentCount: 5, faces: 2, bothFacesUploaded: false }),
    ).toEqual({ canDirectPrint: false, blockedAiDraft: false });
  });

  it('two-face AI item is never marked blockedAiDraft (the two-face hint covers it)', () => {
    expect(
      evaluateDirectPrint({ canWork: true, isAiDesign: true, hasUploadedDesign: false, attachmentCount: 1, faces: 2, bothFacesUploaded: false }),
    ).toEqual({ canDirectPrint: false, blockedAiDraft: false });
  });
});

describe('nextFaceUpload (two-face version numbering)', () => {
  it('first upload of either face starts at version 1', () => {
    expect(nextFaceUpload([], 'front')).toBe(1);
    expect(nextFaceUpload([], 'back')).toBe(1);
  });

  it('uploading the missing face of an incomplete version keeps the same version', () => {
    const designs: FaceDesignLike[] = [{ version: 1, face: 'front' }];
    expect(nextFaceUpload(designs, 'back')).toBe(1);
  });

  it('re-uploading a face the current version already has starts the next version', () => {
    const designs: FaceDesignLike[] = [{ version: 1, face: 'front' }];
    expect(nextFaceUpload(designs, 'front')).toBe(2);
  });

  it('uploading any face when the current version is complete starts the next version', () => {
    const designs: FaceDesignLike[] = [
      { version: 1, face: 'front' },
      { version: 1, face: 'back' },
    ];
    expect(nextFaceUpload(designs, 'front')).toBe(2);
    expect(nextFaceUpload(designs, 'back')).toBe(2);
  });

  it('after re-upload lands on a fresh incomplete version, the other face fills the same version', () => {
    // v1 complete → re-upload front → v2 {front} → now upload back → still v2 (fills the pair).
    const designs: FaceDesignLike[] = [
      { version: 1, face: 'front' },
      { version: 1, face: 'back' },
      { version: 2, face: 'front' },
    ];
    expect(nextFaceUpload(designs, 'back')).toBe(2);
    expect(nextFaceUpload(designs, 'front')).toBe(3);
  });

  it('ignores legacy face=null rows when deciding the next version', () => {
    const designs: FaceDesignLike[] = [{ version: 1, face: null }];
    expect(nextFaceUpload(designs, 'front')).toBe(1);
  });
});

describe('latestVersionFaces / hasBothFaces', () => {
  it('returns null when there are no designs', () => {
    expect(latestVersionFaces([])).toBeNull();
    expect(hasBothFaces([])).toBe(false);
  });

  it('reports which faces the latest version has', () => {
    const designs: FaceDesignLike[] = [
      { version: 1, face: 'front' },
      { version: 1, face: 'back' },
      { version: 2, face: 'front' },
    ];
    expect(latestVersionFaces(designs)).toEqual({ version: 2, hasFront: true, hasBack: false });
    expect(hasBothFaces(designs)).toBe(false);
  });

  it('hasBothFaces is true only when the latest version carries both faces', () => {
    const complete: FaceDesignLike[] = [
      { version: 3, face: 'front' },
      { version: 3, face: 'back' },
    ];
    expect(hasBothFaces(complete)).toBe(true);
  });
});

describe('serviceFaceCount', () => {
  it('maps the raw services.faces column to 1 | 2, defaulting to 1', () => {
    expect(serviceFaceCount({ faces: 2 })).toBe(2);
    expect(serviceFaceCount({ faces: 1 })).toBe(1);
    expect(serviceFaceCount({ faces: null })).toBe(1);
    expect(serviceFaceCount({})).toBe(1);
    expect(serviceFaceCount(null)).toBe(1);
    expect(serviceFaceCount(undefined)).toBe(1);
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
