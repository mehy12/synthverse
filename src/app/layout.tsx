import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "OceanSentinel — Marine Ecosystem Intelligence Platform",
  description:
    "Anonymous threat reporting, AI root-cause tracing, biodiversity loss forecasting, and government-credit rewards. Turning oceanic stakeholders into active guardians.",
  keywords: [
    "marine pollution",
    "ocean monitoring",
    "anonymous reporting",
    "guardian credits",
    "biodiversity forecast",
    "pollution tracing",
    "Gulf of Mannar",
    "environmental intelligence",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} data-scroll-behavior="smooth">
      <body>
        <Navbar />
        <main style={{ paddingTop: "var(--nav-height)" }}>{children}</main>
      </body>
    </html>
  );
}
