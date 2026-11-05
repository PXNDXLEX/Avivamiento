import type { Metadata, Viewport } from 'next';
import './globals.css';
import ThemeToggle from './components/ThemeToggle';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://avivamiento-leon.vercel.app';

export const viewport: Viewport = {
  themeColor: '#0a0a0c',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Avivamiento León de la Tribu de Judá',
    template: '%s | Avivamiento León de la Tribu de Judá',
  },
  description: 'Portal de gestión y registro de miembros — Iglesia Pentecostal Avivamiento León de la Tribu de Judá, Isla de Margarita, Venezuela.',
  keywords: ['iglesia', 'pentecostal', 'avivamiento', 'Margarita', 'Venezuela', 'León de Judá', 'consolidación', 'casas de dios'],
  authors: [{ name: 'Iglesia Pentecostal Avivamiento León de la Tribu de Judá' }],
  creator: 'Avivamiento León de la Tribu de Judá',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo-circle.png', type: 'image/png' },
      { url: '/logo.jpg', type: 'image/jpeg' },
    ],
    shortcut: '/logo.jpg',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/logo.jpg', type: 'image/jpeg' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'es_VE',
    url: siteUrl,
    siteName: 'Avivamiento León de la Tribu de Judá',
    title: 'Avivamiento León de la Tribu de Judá',
    description: 'Portal de gestión y registro de miembros — Iglesia Pentecostal Avivamiento León de la Tribu de Judá, Isla de Margarita, Venezuela.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Avivamiento León de la Tribu de Judá — Portal Oficial',
        type: 'image/jpeg',
      },
      {
        url: '/banner-meta.png',
        width: 1200,
        height: 630,
        alt: 'Avivamiento León de la Tribu de Judá',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Avivamiento León de la Tribu de Judá',
    description: 'Portal de gestión y registro de miembros — Iglesia Pentecostal Avivamiento León de la Tribu de Judá, Porlamar, Isla de Margarita.',
    images: ['/og-image.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/jpeg" href="/logo.jpg" />
        <link rel="apple-touch-icon" href="/logo.jpg" />
      </head>
      <body>
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
