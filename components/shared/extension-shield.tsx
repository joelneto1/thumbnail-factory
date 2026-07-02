"use client";

import * as React from "react";

/**
 * Some Chrome extensions inject content scripts that throw unhandled
 * promise rejections (e.g. `Failed to fetch dynamically imported module:
 * chrome-extension://.../pageView.js`). Under React 19's strict hydration,
 * these can abort hydration and leave the page partially rendered.
 *
 * This shield captures and silences errors that originate from
 * `chrome-extension://` or `moz-extension://` URLs so they don't
 * propagate to React's error boundary.
 */
export function ExtensionShield() {
  React.useEffect(() => {
    const isExtensionError = (msg: string) =>
      msg.includes("chrome-extension://") ||
      msg.includes("moz-extension://") ||
      msg.includes("Failed to fetch dynamically imported module");

    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const msg =
        (reason && (reason.message || String(reason))) || String(reason);
      const stack = (reason && reason.stack) || "";
      if (isExtensionError(msg) || isExtensionError(stack)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    const onError = (e: ErrorEvent) => {
      const msg = e.message ?? "";
      const filename = e.filename ?? "";
      if (isExtensionError(msg) || isExtensionError(filename)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };

    window.addEventListener("unhandledrejection", onRejection, true);
    window.addEventListener("error", onError, true);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection, true);
      window.removeEventListener("error", onError, true);
    };
  }, []);

  return null;
}
