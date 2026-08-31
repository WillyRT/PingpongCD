import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PingPongCD - Circuito Oficial de Tenis de Mesa Ciudad Ducal',
  description: 'Plataforma oficial del Circuito de Tenis de Mesa Ciudad Ducal. Torneos, cuadros eliminatorios y ranking oficial ELO Glicko-2.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PingPongCD',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0f',
};

import { Navbar } from '@/components/Navbar';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased flex flex-col">
        <Navbar />
        <div className="flex-1 pb-16 md:pb-0">{children}</div>
      </body>
    </html>
  );
}
