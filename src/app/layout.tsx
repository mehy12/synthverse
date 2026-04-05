import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "HiveMind â€” AI-Powered Urban Flood Digital Twin",
  description:
    "Real-time flood simulation, cascade forecasting, evacuation zone mapping, and AI-driven disaster response. Turning urban data into life-saving decisions.",
  keywords: [
    "urban flooding",
    "flood monitoring",
    "digital twin",
    "disaster response",
    "cascade forecast",
    "evacuation zones",
    "flood sensor",
    "AI flood prediction",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <AuthProvider>
          <Navbar />
          <main className="app-main">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}

