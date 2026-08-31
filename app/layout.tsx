import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

// manifest source: public/manifest.json, per TRD section 11.1
export const metadata: Metadata = {
  title: "Autopilot | Nodus Limited",
  description: "Care management for UK care providers — powered by AI.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#003087",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css"
        />
      </head>
      <body className="font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
