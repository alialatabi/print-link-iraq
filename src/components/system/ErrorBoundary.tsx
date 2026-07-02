import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * App-wide React error boundary.
 *
 * Without it, an uncaught render error white-screens the installed native app with no way out
 * (no URL bar, no refresh, pull-to-refresh does nothing on a blank document). This catches the
 * error, logs it, and shows an Arabic recovery screen with two escape hatches:
 *   • "إعادة المحاولة" — reset the boundary and re-render (recovers from transient errors).
 *   • "العودة للرئيسية" — a full reload to `/` via window.location.assign, the safest recovery:
 *     it rebuilds the entire app (router + providers + everything) from a clean slate and needs
 *     no router context — which may be exactly what failed.
 *
 * Deliberately dependency-free: no motion, no router hooks, inline styles only — so the fallback
 * renders even when the tree that owns the design-system / router providers is what crashed.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No remote logging in this app — surface to the browser console / native logcat for debugging.
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  private readonly handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  private readonly handleGoHome = (): void => {
    window.location.assign('/');
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div dir="rtl" style={styles.overlay}>
        <div style={styles.card}>
          <div style={styles.badge} aria-hidden="true">!</div>
          <h1 style={styles.title}>حدث خطأ غير متوقع</h1>
          <p style={styles.message}>
            نعتذر، حدث خلل أثناء عرض الصفحة. يمكنك المحاولة مرة أخرى أو العودة إلى الصفحة الرئيسية.
          </p>
          <div style={styles.actions}>
            <button type="button" onClick={this.handleRetry} style={styles.primaryBtn}>
              إعادة المحاولة
            </button>
            <button type="button" onClick={this.handleGoHome} style={styles.secondaryBtn}>
              العودة للرئيسية
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// Inline styles keep the fallback self-contained (immune to a broken/absent stylesheet or a
// design-system provider that failed to mount). Palette matches the app: cream bg, navy brand.
const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    boxSizing: 'border-box',
    background: '#F6EFE5',
    fontFamily: "'Tajawal', 'Cairo', system-ui, sans-serif",
    overflow: 'auto',
  },
  card: {
    width: '100%',
    maxWidth: '380px',
    background: '#FFFFFF',
    borderRadius: '20px',
    padding: '28px 24px',
    textAlign: 'center',
    boxShadow: '0 8px 22px -8px rgb(80 60 40 / 0.16), 0 2px 6px -2px rgb(80 60 40 / 0.08)',
  },
  badge: {
    width: '64px',
    height: '64px',
    margin: '0 auto 18px',
    borderRadius: '50%',
    background: '#FEECEC',
    color: '#DC2626',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '34px',
    fontWeight: 800,
    lineHeight: 1,
  },
  title: {
    margin: '0 0 10px',
    fontSize: '20px',
    fontWeight: 800,
    color: '#243262',
  },
  message: {
    margin: '0 0 24px',
    fontSize: '15px',
    lineHeight: 1.7,
    color: '#6F6657',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  primaryBtn: {
    width: '100%',
    padding: '13px 16px',
    borderRadius: '14px',
    border: 'none',
    background: '#243262',
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  secondaryBtn: {
    width: '100%',
    padding: '13px 16px',
    borderRadius: '14px',
    border: '1.5px solid #E3D9C9',
    background: 'transparent',
    color: '#243262',
    fontSize: '15px',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
};

export default ErrorBoundary;
