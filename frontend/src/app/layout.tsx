import type { ReactNode } from "react";

import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" style={{ height: "100%" }} suppressHydrationWarning>
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          height: "100%",
          overflow: "hidden",
        }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
