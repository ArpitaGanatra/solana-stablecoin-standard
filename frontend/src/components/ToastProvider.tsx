"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      closeButton
      duration={5000}
      visibleToasts={4}
      toastOptions={{
        style: {
          background: "#161616",
          border: "1px solid #2a2a2a",
          color: "#ffffff",
          fontSize: "14px",
          fontFamily: "var(--font-body)",
          borderRadius: "12px",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        },
        classNames: {
          title: "toast-title",
          description: "toast-description",
          closeButton: "toast-close",
          actionButton: "toast-action",
        },
      }}
    />
  );
}
