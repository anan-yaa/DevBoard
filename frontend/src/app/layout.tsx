import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        style={{ fontFamily: "system-ui, sans-serif", margin: 24 }}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
