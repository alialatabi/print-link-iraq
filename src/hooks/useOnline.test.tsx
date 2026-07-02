/**
 * Tests for useOnline — the online/offline state logic (web path).
 *
 * The native `@capacitor/network` branch is bypassed by mocking `@/lib/platform` so
 * `isNativeApp` is false; the hook then relies purely on `navigator.onLine` + the window
 * `online`/`offline` events, which jsdom supports.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Force the web (non-native) path so the hook never imports @capacitor/network.
vi.mock('@/lib/platform', () => ({ isNativeApp: false }));

// Import AFTER the mock is registered.
import { useOnline } from './useOnline';

function setNavigatorOnLine(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

describe('useOnline', () => {
  beforeEach(() => setNavigatorOnLine(true));
  afterEach(() => setNavigatorOnLine(true));

  it('seeds its initial value from navigator.onLine', () => {
    setNavigatorOnLine(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);
  });

  it('flips to false on an "offline" event and back to true on "online"', () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    act(() => { window.dispatchEvent(new Event('offline')); });
    expect(result.current).toBe(false);

    act(() => { window.dispatchEvent(new Event('online')); });
    expect(result.current).toBe(true);
  });

  it('removes its window listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useOnline());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    removeSpy.mockRestore();
  });
});
