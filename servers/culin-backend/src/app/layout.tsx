import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CustomAuthProvider } from "@/hooks/useCustomAuth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CulinAI — Adaptive Culinary Intelligence",
  description:
    "CulinAI helps chefs and food teams create balanced, culturally grounded dishes through adaptive ingredient, technique, and flavor recommendations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <CustomAuthProvider>
          {children}
        </CustomAuthProvider>
      </body>
    </html>
  );
}
