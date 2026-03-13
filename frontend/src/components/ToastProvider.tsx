"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      richColors
      closeButton
      duration={5000}
      visibleToasts={4}
      toastOptions={{
        style: {
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          color: "var(--text-primary)",
          fontSize: "14px",
        },
      }}
    />
  );
}
