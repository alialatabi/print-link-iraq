import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNative } from "./lib/native";
import ErrorBoundary from "./components/system/ErrorBoundary";
import OfflineBanner from "./components/system/OfflineBanner";

// OfflineBanner sits OUTSIDE the ErrorBoundary so the connectivity indicator survives even a
// full app crash. ErrorBoundary wraps <App/> so a render error shows a recoverable Arabic
// fallback instead of an unrecoverable white screen in the native app. Neither needs the router.
createRoot(document.getElementById("root")!).render(
  <>
    <OfflineBanner />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </>,
);

// Native (Capacitor) startup — status bar + splash + keyboard-aware scrolling. No-op on the web.
initNative();
