import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boba House",
  description: "A tiny 2D pixel tea shop game built with Next.js and Phaser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
