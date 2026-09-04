'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsLight(true);
      document.documentElement.classList.add('light');
    }
  }, []);

  const toggleTheme = () => {
    if (isLight) {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
      setIsLight(false);
    } else {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
      setIsLight(true);
    }
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle-btn"
      title={isLight ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
    >
      <div className={`theme-toggle-icon ${isLight ? 'is-light' : 'is-dark'}`}>
        {isLight ? <Sun size={20} /> : <Moon size={20} />}
      </div>
      
      <style jsx>{`
        .theme-toggle-btn {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--bg-card);
          border: 1px solid var(--border-gold);
          color: var(--text-gold);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 9999;
          box-shadow: var(--shadow-gold);
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), 
                      background-color 0.4s ease, 
                      border-color 0.4s ease;
        }

        .theme-toggle-btn:hover {
          transform: scale(1.1) rotate(5deg);
          background: var(--bg-card-hover);
        }

        .theme-toggle-btn:active {
          transform: scale(0.95);
        }

        .theme-toggle-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.5s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.3s ease;
        }

        .is-light {
          animation: spin-in 0.5s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
        }

        .is-dark {
          animation: spin-in-reverse 0.5s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
        }

        @keyframes spin-in {
          0% { transform: rotate(-90deg) scale(0.5); opacity: 0; }
          100% { transform: rotate(0) scale(1); opacity: 1; }
        }

        @keyframes spin-in-reverse {
          0% { transform: rotate(90deg) scale(0.5); opacity: 0; }
          100% { transform: rotate(0) scale(1); opacity: 1; }
        }

        @media (max-width: 768px) {
          .theme-toggle-btn {
            bottom: 90px; /* Above the mobile bottom nav */
            right: 16px;
            width: 40px;
            height: 40px;
          }
        }
      `}</style>
    </button>
  );
}
