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
    "The cloud hosting platform purpose-built for speed, isolation, and scale. Deploy Beyond Limits.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-[#1d5bff]/12 selection:text-[#1d5bff]">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
