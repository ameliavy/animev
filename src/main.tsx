import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register the service worker only in production and outside Lovable's preview iframe.
if (import.meta.env.PROD && typeof window !== "undefined") {
  const inIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const isPreviewHost = /lovable(project)?\.app$|lovable\.dev$/i.test(window.location.hostname);
  if (!inIframe && !isPreviewHost) {
    import("virtual:pwa-register").then(({ registerSW }) => {
      registerSW({ immediate: true });
    }).catch(() => { /* ignore */ });
  }
}
