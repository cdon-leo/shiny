import type { Metadata } from "next";
import { Titillium_Web, Geist_Mono, Press_Start_2P, Handjet } from "next/font/google";
import "./globals.css";

const titilliumWeb = Titillium_Web({
  weight: ["200", "300", "400", "600", "700", "900"],
  variable: "--font-titillium-web",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pressStart2P = Press_Start_2P({
  weight: ["400"],
  variable: "--font-press-start-2p",
  subsets: ["latin"],
});

const handjet = Handjet({
  weight: ["400"],
  variable: "--font-handjet",
  subsets: ["latin"],
});

const fontClasses = `${titilliumWeb.variable} ${geistMono.variable} ${pressStart2P.variable} ${handjet.variable}`;

export const metadata: Metadata = {
  title: "Live Sales Dashboard",
  description: "Real-time sales comparison dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fontClasses} antialiased bg-black text-foreground font-sans m-0 p-0 overflow-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
