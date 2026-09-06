'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { getRandomVersiculo } from '@/lib/utils';
import { Eye, EyeOff, LogIn } from 'lucide-react';

/** Convierte un nombre de usuario al email interno oculto */
function usernameToEmail(username: string) {
  return `${username.toLowerCase().trim()}@avivamiento.internal`;
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [versiculo, setVersiculo] = useState({ texto: '', referencia: '' });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setVersiculo(getRandomVersiculo());
    setMounted(true);
  }, []);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });

    if (error) {
      setError('Usuario o contraseña incorrectos.');
      setLoading(false);
    } else {
      window.location.href = '/dashboard';
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        background:
          'radial-gradient(ellipse at 20% 50%, rgba(201,168,76,0.09) 0%, transparent 60%),' +
          'radial-gradient(ellipse at 80% 20%, rgba(184,115,51,0.07) 0%, transparent 50%),' +
          'var(--bg-primary)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        {/* ── Brand ── */}
        <div className="animate-slide-up" style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '120px',
              height: '120px',
              margin: '0 auto 1.25rem',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid var(--border-gold)',
              animation: 'pulse-glow 3s ease-in-out infinite',
              position: 'relative',
              background: 'var(--bg-primary)',
            }}
          >
            <img
              src="/logo.jpg"
              alt="Avivamiento León de la Tribu de Judá"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <h1
            className="font-cinzel"
            style={{ fontSize: 'clamp(1.4rem, 4vw, 1.8rem)', marginBottom: '0.3rem' }}
          >
            Avivamiento
          </h1>
          <p className="text-gold font-cinzel" style={{ fontSize: '0.9rem' }}>
            León de la Tribu de Judá
          </p>
          <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Isla de Margarita, Venezuela
          </p>
        </div>

        {mounted && versiculo.texto && (
          <div className="verse-banner animate-fade-in" style={{ padding: '1.25rem 1.5rem' }}>
            <p className="verse-text" style={{ fontSize: '0.92rem', marginBottom: '0.4rem' }}>
              &ldquo;{versiculo.texto}&rdquo;
            </p>
            <p className="verse-ref">
              — {versiculo.referencia}
            </p>
          </div>
        )}

        {/* ── Form card ── */}
        <div className="card-glass animate-slide-up" style={{ padding: '2rem' }}>
          <h2
            className="font-cinzel"
            style={{
              fontSize: '1.1rem',
              marginBottom: '1.5rem',
              textAlign: 'center',
              color: 'var(--text-primary)',
            }}
          >
            Portal de Acceso
          </h2>

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div className="form-group">
              <label htmlFor="username" className="form-label">
                Usuario
              </label>
              <input
                id="username"
                className="form-input"
                type="text"
                placeholder="tu_usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  style={{ paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  padding: '0.75rem 1rem',
                  background: 'rgba(192,57,43,0.1)',
                  border: '1px solid rgba(192,57,43,0.3)',
                  borderRadius: '8px',
                  color: '#e74c3c',
                  fontSize: '0.85rem',
                }}
              >
                {error}
              </div>
            )}

            <button
              id="login-btn"
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ marginTop: '0.5rem' }}
            >
              {loading ? (
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid rgba(0,0,0,0.3)',
                    borderTopColor: '#000',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                    display: 'inline-block',
                  }}
                />
              ) : (
                <>
                  <LogIn size={18} />
                  Entrar al Portal
                </>
              )}
            </button>
          </form>
        </div>

        <p
          className="text-muted animate-fade-in"
          style={{ textAlign: 'center', fontSize: '0.75rem' }}
        >
          ¿Sin acceso? Contacta al administrador de la iglesia.
        </p>
      </div>
    </main>
  );
}
