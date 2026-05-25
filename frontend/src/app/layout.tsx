import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${APP_NAME} — UAV Mission Simulator`,
  description: "Professional UAV Mission Simulation & Training Platform",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg-base text-text-primary antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
