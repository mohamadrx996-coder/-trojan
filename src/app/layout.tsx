import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TRJ Bot v2.0 - Discord Tools",
  description: "أداة متكاملة لديسكورد - نيوكر، نسخ، تسطير، تلفيل، صيد يوزرات",
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
