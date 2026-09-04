import type { Metadata } from 'next';
import './globals.css';
import ThemeToggle from './components/ThemeToggle';

export const metadata: Metadata = {
  title: 'Avivamiento León de la Tribu de Judá',
  description: 'Portal de gestión y registro de miembros — Iglesia Pentecostal Avivamiento León de la Tribu de Judá, Isla de Margarita, Venezuela.',
  keywords: 'iglesia, pentecostal, avivamiento, Margarita, Venezuela, León de Judá',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
