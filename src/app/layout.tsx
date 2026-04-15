import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRJ Bot v4.0 - Discord Tools",
  description: "أداة متكاملة لديسكورد - 19 ميزة: نيوكر، نسخ، تسطير، تلفيل، صيد يوزرات، فحص توكنات، تثبيت فويس، توليد توكنات",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
