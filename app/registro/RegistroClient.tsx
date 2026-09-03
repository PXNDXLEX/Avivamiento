'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { signOut } from '@/app/actions';
import type { Profile, Member } from '@/lib/types';
import { normalizarCiudad, formatearFecha, getRandomVersiculo } from '@/lib/utils';
import {
  LogOut,
  Plus,
  Users,
  CheckCircle,
  AlertTriangle,
  X,
  Edit2,
  Loader2,
  Home,
  BookOpen,
  Flame
} from 'lucide-react';

interface Props {
  profile: Profile;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card-metric" style={{ padding: '1.25rem' }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
        {label}
      </p>
      <p className="font-cinzel" style={{ fontSize: '2rem', fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </p>
    </div>
  );
}

export default function RegistroClient({ profile }: Props) {
  const supabase = createClient();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [versiculo, setVersiculo] = useState({ texto: '', referencia: '' });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setVersiculo(getRandomVersiculo());
    setMounted(true);
  }, []);

  /* Form */
  const emptyForm = {
    full_name: '',
    age: '',
    city: '',
    address: '',
    phone: '',
    status: 'Nuevo' as Member['status'],
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Navigation & Visibility
  const [showFormModal, setShowFormModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'list'>('home');

  /* Toast */
  const [toast, setToast] = useState<{
    msg: string;
    type: 'success' | 'error';
  } | null>(null);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  /* Fetch own members */
  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('consolidator_id', profile.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setMembers(data ?? []);
    setLoading(false);
  }, [supabase, profile.id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  function resetForm() {
    setForm(emptyForm);
    setError('');
    setEditingId(null);
    setShowFormModal(false);
  }

  function startEdit(member: Member) {
    setForm({
      full_name: member.full_name,
      age: member.age?.toString() ?? '',
      city: member.city ?? '',
      address: member.address ?? '',
      phone: member.phone ?? '',
      status: member.status,
    });
    setEditingId(member.id);
    setShowFormModal(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setError('El nombre completo es requerido.');
      return;
    }

    setSaving(true);
    setError('');

    const payload = {
      full_name: form.full_name.trim(),
      age: form.age ? parseInt(form.age) : null,
      city: form.city ? normalizarCiudad(form.city) : null,
      address: form.address || null,
      phone: form.phone || null,
      status: form.status,
    };

    try {
      if (editingId) {
        const { error: err } = await supabase
          .from('members')
          .update(payload)
          .eq('id', editingId);
        if (err) throw err;
        showToast('Miembro actualizado correctamente.');
      } else {
        const { error: err } = await supabase.from('members').insert({
          ...payload,
          consolidator_id: profile.id,
          consolidator_name: profile.full_name,
        });
        if (err) throw err;
        showToast('¡Miembro registrado exitosamente!');
        // Automatically take them to the list after adding their first member
        setActiveTab('list');
      }
      resetForm();
      fetchMembers();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error desconocido al guardar.');
    } finally {
      setSaving(false);
    }
  }

  const statusBadgeClass: Record<Member['status'], string> = {
    Nuevo: 'badge-nuevo',
    Reconciliado: 'badge-reconciliado',
    Visitante: 'badge-visitante',
  };

  const stats = {
    total: members.length,
    nuevo: members.filter((m) => m.status === 'Nuevo').length,
    reconciliado: members.filter((m) => m.status === 'Reconciliado').length,
    visitante: members.filter((m) => m.status === 'Visitante').length,
  };

  const renderForm = () => (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      <div className="form-group">
        <label htmlFor="full_name" className="form-label">
          Nombre completo *
        </label>
        <input
          id="full_name"
          className="form-input"
          type="text"
          placeholder="Nombre y apellido"
          value={form.full_name}
          onChange={(e) =>
            setForm((f) => ({ ...f, full_name: e.target.value }))
          }
          required
        />
      </div>

      <div className="grid-2">
        <div className="form-group">
          <label htmlFor="age" className="form-label">Edad</label>
          <input
            id="age"
            className="form-input"
            type="number"
            placeholder="25"
            min="1"
            max="120"
            value={form.age}
            onChange={(e) =>
              setForm((f) => ({ ...f, age: e.target.value }))
            }
          />
        </div>
        <div className="form-group">
          <label htmlFor="status" className="form-label">Estado</label>
          <select
            id="status"
            className="form-select"
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                status: e.target.value as Member['status'],
              }))
            }
          >
            <option>Nuevo</option>
            <option>Reconciliado</option>
            <option>Visitante</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="city" className="form-label">Ciudad</label>
        <input
          id="city"
          className="form-input"
          type="text"
          placeholder="Porlamar"
          value={form.city}
          onChange={(e) =>
            setForm((f) => ({ ...f, city: e.target.value }))
          }
        />
      </div>

      <div className="form-group">
        <label htmlFor="address" className="form-label">Dirección</label>
        <input
          id="address"
          className="form-input"
          type="text"
          placeholder="Urb. Las Palmas, casa #12..."
          value={form.address}
          onChange={(e) =>
            setForm((f) => ({ ...f, address: e.target.value }))
          }
        />
      </div>

      <div className="form-group">
        <label htmlFor="phone" className="form-label">Teléfono</label>
        <input
          id="phone"
          className="form-input"
          type="tel"
          placeholder="0414-000-0000"
          value={form.phone}
          onChange={(e) =>
            setForm((f) => ({ ...f, phone: e.target.value }))
          }
        />
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
        id="submit-member-btn"
        type="submit"
        className="btn btn-primary btn-lg"
        disabled={saving}
        style={{ marginTop: '0.5rem' }}
      >
        {saving ? (
          <Loader2
            size={18}
            style={{ animation: 'spin 1s linear infinite' }}
          />
        ) : editingId ? (
          'Guardar cambios'
        ) : (
          <>
            <Plus size={18} />
            Registrar Miembro
          </>
        )}
      </button>
    </form>
  );

  return (
    <div className="app-layout">
      {/* Toast */}
      {toast && (
        <div
          role="alert"
          className={`toast toast-${toast.type === 'success' ? 'success' : 'error'}`}
          style={{
            position: 'fixed',
            top: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            animation: 'slide-in-right 0.3s ease',
          }}
        >
          {toast.type === 'success' ? (
            <CheckCircle size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
          {toast.msg}
        </div>
      )}

      {/* ── Sidebar (Desktop) ── */}
      <aside className="sidebar hide-on-mobile" style={{ padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '1px solid var(--border-gold)',
              background: '#000',
              flexShrink: 0,
            }}
          >
            <img src="/logo.jpg" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <p className="font-cinzel" style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
              Avivamiento
            </p>
            <p className="text-gold" style={{ fontSize: '0.7rem' }}>León de la Tribu de Judá</p>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <p className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>
            Mi Perfil
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="avatar-placeholder" style={{ width: 40, height: 40, fontSize: '1rem' }}>
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {profile.full_name}
              </p>
              <span className="badge badge-user" style={{ fontSize: '0.65rem' }}>Consolidador</span>
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button 
            onClick={() => setActiveTab('home')}
            className={`btn ${activeTab === 'home' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
          >
            <Home size={18} />
            Inicio
          </button>
          <button 
            onClick={() => setActiveTab('list')}
            className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
          >
            <Users size={18} />
            Mis Registros
          </button>
        </nav>

        <form action={signOut} style={{ marginTop: 'auto' }}>
            <button type="submit" className="btn btn-secondary" style={{ width: '100%', gap: '0.5rem' }}>
            <LogOut size={16} />
            Cerrar Sesión
            </button>
        </form>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content">
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="hide-on-desktop" style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="avatar-placeholder" style={{ width: 36, height: 36, fontSize: '0.9rem' }}>
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>{profile.full_name}</p>
              <span className="badge badge-user" style={{ fontSize: '0.6rem' }}>Consolidador</span>
            </div>
          </div>
          <form action={signOut}>
            <button type="submit" className="btn btn-secondary btn-icon" style={{ width: 36, height: 36 }}>
                <LogOut size={16} />
            </button>
          </form>
        </div>

        {/* ── Home Tab ── */}
        {activeTab === 'home' && (
          <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 className="font-cinzel" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>
              Bienvenido, {profile.full_name.split(' ')[0]}
            </h1>
            <p className="text-muted" style={{ marginBottom: '2rem' }}>
              Aquí tienes un resumen de tu impacto en la congregación.
            </p>

            {/* Versículo del día */}
            {mounted && versiculo.texto && (
              <div
                style={{
                  background: 'rgba(201,168,76,0.05)',
                  border: '1px solid var(--border-gold)',
                  borderRadius: 'var(--border-radius)',
                  padding: '1.5rem',
                  textAlign: 'center',
                  fontStyle: 'italic',
                  fontSize: '0.95rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  marginBottom: '2.5rem',
                }}
              >
                <p>&ldquo;{versiculo.texto}&rdquo;</p>
                <p className="text-gold" style={{ marginTop: '0.5rem', fontStyle: 'normal', fontSize: '0.8rem', fontWeight: 600 }}>
                  — {versiculo.referencia}
                </p>
              </div>
            )}

            <h2 className="font-cinzel" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
              Tu Resumen de Registros
            </h2>
            <div className="grid-2">
              <StatCard label="Total Registrados" value={stats.total} color="var(--gold-primary)" />
              <StatCard label="Nuevos" value={stats.nuevo} color="#2ecc71" />
              <StatCard label="Reconciliados" value={stats.reconciliado} color="#3498db" />
              <StatCard label="Visitantes" value={stats.visitante} color="#C9A84C" />
            </div>
          </div>
        )}

        {/* ── List Tab ── */}
        {activeTab === 'list' && (
          <div className="animate-fade-in" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
            {/* List Section (Expands) */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h2 className="font-cinzel" style={{ fontSize: '1.3rem' }}>Mis Registros</h2>
                <span className="badge badge-visitante">{members.length} miembro{members.length !== 1 ? 's' : ''}</span>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
                  <Loader2 size={32} style={{ margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
                  <p>Cargando registros...</p>
                </div>
              ) : members.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)' }}>
                  <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                  <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Sin registros</p>
                  <p>Aún no tienes registros en tu lista.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {members.map((m) => (
                    <div key={m.id} className="card" style={{ padding: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div className="avatar-placeholder" style={{ width: 42, height: 42, fontSize: '1rem' }}>
                            {m.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p style={{ fontWeight: 600, fontSize: '1.05rem', lineHeight: 1.2 }}>{m.full_name}</p>
                            <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>{formatearFecha(m.created_at)}</p>
                          </div>
                        </div>
                        <button onClick={() => startEdit(m)} className="btn btn-secondary btn-icon" style={{ width: 32, height: 32 }}>
                          <Edit2 size={14} />
                        </button>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        {m.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📞 {m.phone}</div>}
                        {m.city && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📍 {m.city} {m.address ? `- ${m.address}` : ''}</div>}
                        {m.age && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🗓 {m.age} años</div>}
                      </div>
                      
                      <span className={`badge ${statusBadgeClass[m.status]}`}>{m.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form Card (Desktop only, sticky) */}
            <div className="card-glass hide-on-mobile" style={{ width: '380px', position: 'sticky', top: '2rem', padding: '1.75rem', height: 'fit-content' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <h2 className="font-cinzel" style={{ fontSize: '1.1rem' }}>
                  {editingId ? 'Editar Miembro' : 'Nuevo Miembro'}
                </h2>
                {editingId && (
                  <button onClick={resetForm} className="btn btn-secondary btn-icon" style={{ width: 28, height: 28 }}>
                    <X size={14} />
                  </button>
                )}
              </div>
              {renderForm()}
            </div>
          </div>
        )}
      </main>

      {/* ── Form Modal / Bottom Sheet (Mobile Only) ── */}
      {showFormModal && (
        <div className="hide-on-desktop" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          zIndex: 9999, display: 'flex', alignItems: 'flex-end',
          animation: 'fade-in 0.2s ease'
        }}>
          <div style={{
            background: 'var(--bg-secondary)', width: '100%',
            borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
            padding: '1.5rem', borderTop: '1px solid var(--border-gold)',
            maxHeight: '90vh', overflowY: 'auto',
            animation: 'slide-up 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 className="font-cinzel" style={{ fontSize: '1.1rem' }}>
                {editingId ? 'Editar Miembro' : 'Nuevo Miembro'}
              </h2>
              <button onClick={resetForm} className="btn btn-secondary btn-icon" style={{ width: 32, height: 32 }}>
                <X size={16} />
              </button>
            </div>
            {renderForm()}
          </div>
        </div>
      )}

      {/* ── Bottom Navigation (Mobile Only) ── */}
      <nav className="bottom-nav hide-on-desktop">
        <div 
          onClick={() => setActiveTab('home')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', color: activeTab === 'home' ? 'var(--gold-primary)' : 'var(--text-muted)', cursor: 'pointer' }}
        >
          <Home size={22} />
          <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Inicio</span>
        </div>
        <div 
          onClick={() => setActiveTab('list')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', color: activeTab === 'list' ? 'var(--gold-primary)' : 'var(--text-muted)', cursor: 'pointer' }}
        >
          <Users size={22} />
          <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Miembros</span>
        </div>
      </nav>

      {/* ── FAB (Mobile Only) ── */}
      {!showFormModal && (
        <button className="fab-button hide-on-desktop" onClick={() => setShowFormModal(true)}>
          <Plus size={26} />
        </button>
      )}
    </div>
  );
}
