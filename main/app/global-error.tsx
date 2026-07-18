"use client";

import { useEffect } from "react";
import {
  tryClientErrorReload,
} from "@/lib/client-error-recovery";

/**
 * Root-level error UI. Auto-reloads once; if reload already happened,
 * shows a minimal recovery screen instead of Next's blank "Application error".
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const reloaded = tryClientErrorReload(error.message);
    if (!reloaded) {
      console.error("[global-error]", error);
    }
  }, [error]);

  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#fafafa",
          color: "#171717",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 360, textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            页面加载遇到问题
          </p>
          <p style={{ fontSize: 14, color: "#737373", marginBottom: 20, lineHeight: 1.5 }}>
            正在尝试恢复。若仍无法打开，请点击下方按钮刷新页面。
          </p>
          <button
            type="button"
            onClick={() => {
              if (!tryClientErrorReload("manual-reset")) {
                reset();
                window.location.reload();
              }
            }}
            style={{
              appearance: "none",
              border: "none",
              borderRadius: 8,
              background: "#171717",
              color: "#fff",
              padding: "10px 18px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            刷新页面
          </button>
        </div>
      </body>
    </html>
  );
}
