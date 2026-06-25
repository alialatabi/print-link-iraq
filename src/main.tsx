import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initNative } from "./lib/native";

createRoot(document.getElementById("root")!).render(<App />);

// Native (Capacitor) startup — status bar + splash. No-op on the web.
initNative();
