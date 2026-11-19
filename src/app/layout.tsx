import type { Metadata } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const notoBengali = Noto_Sans_Bengali({
  variable: "--font-noto-bengali",
  subsets: ["bengali"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MediQueue BD",
    template: "%s · MediQueue BD",
  },
  description:
    "Appointment management, queue management, waiting time estimation and patient medical records for Bangladesh.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${notoBengali.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
