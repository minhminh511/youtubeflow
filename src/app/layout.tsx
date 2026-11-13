import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./setup-walkthrough.css";
import "./mobile.css";
import "./deployment-diagnostics.css";
import "./studio-workspace.css";
import "./strategy.css";
import "./media-editor.css";

export const metadata: Metadata = {
  title: "Kết nối kênh · TubeFlow",
  description: "Không gian sáng tạo của bạn. Kết nối YouTube an toàn, khám phá dữ liệu và lên kế hoạch nội dung với TubeFlow.",
  applicationName: "TubeFlow",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "TubeFlow", statusBarStyle: "default" },
  // Next.js emits the standard capable tag; retain Apple's tag for older iOS.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8f7fc",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="vi"><head><link rel="stylesheet" href="/fonts/font-faces.css" /></head><body>{children}</body></html>;
}
