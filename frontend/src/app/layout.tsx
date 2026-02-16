import type { Metadata } from "next";
import { Inter, Readex_Pro } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const readexPro = Readex_Pro({
  subsets: ["latin", "arabic"],
  variable: "--font-logo",
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "RAYA — AI Patient Follow-up Platform",
  description: "AI-powered patient follow-up platform — automated check-in calls in Darija",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${readexPro.variable} font-sans antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
