import { ReactNode, useEffect, useRef, useState } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';

const THRESHOLD = 70; // px the user must pull before a release triggers a refresh
const MAX = 110;      // max visual pull distance (rubber-band cap)
const DAMP = 0.5;     // resistance applied to the finger movement

interface Props {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
}

// Native-style swipe-down-to-refresh. Wraps the scroll area; activates only when the
// content is already at the top and the finger drags downward, so normal scrolling and
// inner controls are unaffected. Touch handling uses a non-passive listener so we can
// preventDefault and own the gesture once a pull begins.
export default function PullToRefresh({ onRefresh, children, className }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const active = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;

    const set = (v: number) => { pullRef.current = v; setPull(v); };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      active.current = el.scrollTop <= 0;
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (!active.current || refreshingRef.current) return;
      if (el.scrollTop > 0) { active.current = false; set(0); return; }
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { set(0); return; }
      e.preventDefault(); // we own the gesture now — stop the content from scrolling
      set(Math.min(MAX, dy * DAMP));
    };
    const onEnd = async () => {
      if (!active.current) return;
      active.current = false;
      if (pullRef.current >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        set(THRESHOLD); // hold at the threshold while refreshing
        try { await onRefresh(); } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          set(0);
        }
      } else {
        set(0);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [onRefresh]);

  const ready = pull >= THRESHOLD;
  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      {/* pull indicator */}
      <div
        className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none flex items-center justify-center w-9 h-9 rounded-full bg-white shadow-md border border-[#EFE7DC]"
        style={{
          top: Math.max(6, pull - 38),
          opacity: pull > 6 || refreshing ? 1 : 0,
          transition: active.current ? 'none' : 'top .25s ease, opacity .2s ease',
        }}
      >
        {refreshing ? (
          <Loader2 className="w-[18px] h-[18px] text-[#10B0E0] animate-spin" />
        ) : (
          <ArrowDown
            className="w-[18px] h-[18px] text-[#10B0E0]"
            style={{ transform: ready ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}
          />
        )}
      </div>

      <div
        ref={scroller}
        className="h-full overflow-y-auto overscroll-contain"
        style={{ transform: pull ? `translateY(${pull}px)` : undefined, transition: active.current ? 'none' : 'transform .25s ease' }}
      >
        {children}
      </div>
    </div>
  );
}
