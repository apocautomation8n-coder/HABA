import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#3b7c42",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "HABA — Tu aliado en cada receta y presupuesto",
  description: "App de costeo, precios multicanal y presupuestos para emprendedoras.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HABA",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#fbfaf6] text-neutral-800 antialiased flex flex-col items-center">
        <main className="w-full max-w-md min-h-screen flex flex-col px-4 pt-[max(env(safe-area-inset-top),16px)] pb-4 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
