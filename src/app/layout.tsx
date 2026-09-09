import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HABA — Tu aliado en cada receta y presupuesto",
  description: "App de costeo, precios multicanal y presupuestos para emprendedoras.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[#fbfaf6] text-neutral-800 antialiased flex flex-col items-center">
        <main className="w-full max-w-md min-h-screen flex flex-col px-4 py-6 sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
