import { redirect } from 'next/navigation';

/**
 * Raíz de la app — el middleware maneja la autenticación
 * y redirige a /login o /dashboard según el estado de sesión.
 */
export default function RootPage() {
  redirect('/dashboard');
}
