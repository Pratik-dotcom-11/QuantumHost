import type { Metadata } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "QuantumHost — Deploy Beyond Limits",
    template: "%s | QuantumHost",
  },
  description:
    "Deploy Beyond Limits. Isolated GitHub builds, immutable artifact delivery, custom DNS verification, and AI failure diagnostics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0b0907] font-sans text-[#f7f3ec] antialiased selection:bg-[#f4ba4a]/25 selection:text-[#f7f3ec]">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
