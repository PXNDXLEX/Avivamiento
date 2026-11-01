'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { signOut } from '@/app/actions';
import type { Profile, Member } from '@/lib/types';
import { MUNICIPIOS_NUEVA_ESPARTA } from '@/lib/types';
import { formatearFecha, getRandomVersiculo, formatearTelefono, getWhatsAppUrl, validarTelefonoVenezolano, limpiarTelefonoInput } from '@/lib/utils';
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
  Flame,
  Bell,
  MessageCircle,
  Search,
  Check,
  Phone,
  ClipboardList,
} from 'lucide-react';
import MemberFollowUpSheet from '@/app/components/MemberFollowUpSheet';

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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [versiculo, setVersiculo] = useState({ texto: '', referencia: '' });
  const [mounted, setMounted] = useState(false);

  /* Follow-up state */
  const [selectedFollowUpMember, setSelectedFollowUpMember] = useState<Member | null>(null);
  const [seguimientoFilter, setSeguimientoFilter] = useState<'mine' | 'pending' | 'consolidated' | 'inactivo'>('mine');
  const [seguimientoSearch, setSeguimientoSearch] = useState('');

  /* Form */
  const emptyForm = {
    full_name: '',
    age: '',
    gender: '' as string,
    municipio: '',
    address: '',
    phone: '',
    status: 'Nuevo' as Member['status'],
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [consolidatingConfirmId, setConsolidatingConfirmId] = useState<string | null>(null);
  
  // Navigation & Visibility
  const [showFormModal, setShowFormModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'list' | 'seguimiento'>('home');

  /* Al navegar fuera de seguimiento o cambiar de pestaña, resetear la ficha abierta para regresar siempre al menú principal de seguimiento */
  useEffect(() => {
    if (activeTab !== 'seguimiento') {
      setSelectedFollowUpMember(null);
    }
  }, [activeTab]);

  const handleTabClick = (tab: 'home' | 'list' | 'seguimiento') => {
    setSelectedFollowUpMember(null);
    setActiveTab(tab);
  };
  /* Toast */
  const [toast, setToast] = useState<{
    msg: string;
    type: 'success' | 'error';
  } | null>(null);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  /* Fetch members & profiles - estrictamente sus propios registros */
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

  const fetchProfiles = useCallback(async () => {
    // El consolidador no debe ver los usuarios ni perfiles ajenos
    setProfiles([profile]);
  }, [profile]);

  useEffect(() => {
    fetchMembers();
    fetchProfiles();
  }, [fetchMembers, fetchProfiles]);

  async function toggleConsolidado(member: Member) {
    const isNowConsolidated = member.status !== 'Consolidado' && !member.is_consolidated;
    const newStatus: Member['status'] = isNowConsolidated ? 'Consolidado' : 'Nuevo';
    try {
      const { error: err } = await supabase
        .from('members')
        .update({
          status: newStatus,
          is_consolidated: isNowConsolidated,
        })
        .eq('id', member.id)
        .eq('consolidator_id', profile.id);
      if (err) throw err;
      showToast(isNowConsolidated ? `${member.full_name} marcado como Consolidado 🎉` : 'Estado restablecido a Nuevo');
      fetchMembers();
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar estado.', 'error');
    }
  }

  function resetForm() {
    setForm(emptyForm);
    setError('');
    setEditingId(null);
    setShowFormModal(false);
  }

  function openNewMember() {
    resetForm();
    setShowFormModal(true);
  }

  function startEdit(member: Member) {
    setForm({
      full_name: member.full_name,
      age: member.age?.toString() ?? '',
      gender: member.gender ?? '',
      municipio: member.municipio ?? '',
      address: member.address ?? '',
      phone: member.phone ? member.phone.replace(/\D/g, '') : '',
      status: member.status,
    });
    setEditingId(member.id);
    setShowFormModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setError('El nombre completo es requerido.');
      return;
    }

    setSaving(true);
    // Validación de formato de teléfono venezolano (opcional: si no tiene número, se permite guardar en blanco)
    const digitsOnly = form.phone ? form.phone.replace(/\D/g, '') : '';
    let cleanPhone: string | null = null;

    if (digitsOnly) {
      const phoneVal = validarTelefonoVenezolano(form.phone);
      if (!phoneVal.isValid) {
        setError(phoneVal.error || 'Número de teléfono inválido.');
        setSaving(false);
        return;
      }
      cleanPhone = phoneVal.cleanPhone;
    }

    const payload = {
      full_name: form.full_name.trim(),
      age: form.age ? parseInt(form.age) : null,
      gender: form.gender || null,
      municipio: form.municipio || null,
      address: form.address || null,
      phone: cleanPhone,
      status: form.status,
      is_consolidated: form.status === 'Consolidado',
      house_group_id: null,
    };

    try {
      if (editingId) {
        const { error: err } = await supabase
          .from('members')
          .update(payload)
          .eq('id', editingId)
          .eq('consolidator_id', profile.id);
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
        handleTabClick('list');
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
    Consolidado: 'badge-consolidado',
    Inactivo: 'badge-inactivo',
  };

  const myMembers = members.filter((m) => m.consolidator_id === profile.id);

  const filteredMembers = myMembers.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      m.full_name.toLowerCase().includes(q) ||
      (m.phone ?? '').toLowerCase().includes(q) ||
      (m.municipio ?? '').toLowerCase().includes(q) ||
      (m.address ?? '').toLowerCase().includes(q) ||
      m.status.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: myMembers.length,
    nuevo: myMembers.filter((m) => m.status === 'Nuevo').length,
    reconciliado: myMembers.filter((m) => m.status === 'Reconciliado').length,
    visitante: myMembers.filter((m) => m.status === 'Visitante').length,
    consolidado: myMembers.filter((m) => m.status === 'Consolidado' || m.is_consolidated).length,
    inactivo: myMembers.filter((m) => m.status === 'Inactivo').length,
  };

  const pendingConsolidation = myMembers.filter(
    (m) => m.status !== 'Consolidado' && !m.is_consolidated && m.status !== 'Inactivo'
  );

  const seguimientoList = myMembers.filter((m) => {
    if (seguimientoSearch.trim()) {
      const q = seguimientoSearch.toLowerCase().trim();
      const match =
        m.full_name.toLowerCase().includes(q) ||
        (m.phone ?? '').toLowerCase().includes(q) ||
        (m.municipio ?? '').toLowerCase().includes(q);
      if (!match) return false;
    }

    if (seguimientoFilter === 'pending') {
      return m.status !== 'Consolidado' && !m.is_consolidated && m.status !== 'Inactivo';
    } else if (seguimientoFilter === 'consolidated') {
      return m.status === 'Consolidado' || m.is_consolidated;
    } else if (seguimientoFilter === 'inactivo') {
      return m.status === 'Inactivo';
    }
    return true; // 'mine': todos sus miembros asignados
  });

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
          <label htmlFor="gender" className="form-label">Género</label>
          <select
            id="gender"
            className="form-select"
            value={form.gender}
            onChange={(e) =>
              setForm((f) => ({ ...f, gender: e.target.value }))
            }
          >
            <option value="">-- Seleccionar --</option>
            <option>Masculino</option>
            <option>Femenino</option>
          </select>
        </div>
      </div>

            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
        <label htmlFor="status" className="form-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
          Estado / Condición del Miembro *
        </label>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>
          {form.status === 'Nuevo' && '✨ Nuevo creyente o asistente'}
          {form.status === 'Reconciliado' && '🕊️ Persona reconciliada con el Señor'}
          {form.status === 'Visitante' && '🚶 Visitante a consolidar'}
          {form.status === 'Consolidado' && '🛡️ Miembro activo consolidado'}
          {form.status === 'Inactivo' && '⏸️ No asiste actualmente o en pausa pastoral'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
          {(editingId
            ? [
                { key: 'Nuevo', label: 'Nuevo', icon: '✨' },
                { key: 'Reconciliado', label: 'Reconciliado', icon: '🕊️' },
                { key: 'Visitante', label: 'Visitante', icon: '🚶' },
                { key: 'Consolidado', label: 'Consolidado', icon: '🛡️' },
                { key: 'Inactivo', label: 'Inactivo', icon: '⏸️' },
              ]
            : [
                { key: 'Nuevo', label: 'Nuevo', icon: '✨' },
                { key: 'Reconciliado', label: 'Reconciliado', icon: '🕊️' },
                { key: 'Visitante', label: 'Visitante', icon: '🚶' },
              ]
          ).map((st) => {
            const isSel = form.status === st.key;
            return (
              <button
                key={st.key}
                type="button"
                onClick={() => setForm((f) => ({ ...f, status: st.key as Member['status'] }))}
                className={`btn ${isSel ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  padding: '0.55rem 0.5rem',
                  fontSize: '0.82rem',
                  fontWeight: isSel ? 600 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  borderColor: isSel ? 'var(--gold-primary)' : undefined,
                  boxShadow: isSel ? '0 0 8px rgba(201, 168, 76, 0.3)' : 'none',
                  width: '100%',
                }}
              >
                <span>{st.icon}</span>
                <span>{st.label}</span>
              </button>
            );
          })}
        </div>
      </div>


      <div className="form-group">
        <label htmlFor="municipio" className="form-label">Municipio</label>
        <select
          id="municipio"
          className="form-select"
          value={form.municipio}
          onChange={(e) =>
            setForm((f) => ({ ...f, municipio: e.target.value }))
          }
        >
          <option value="">-- Seleccionar Municipio --</option>
          {MUNICIPIOS_NUEVA_ESPARTA.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
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
        <label htmlFor="phone" className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Teléfono <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>(Opcional)</span></span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>11 dígitos (0414, 0424, 0416, 0426, 0412, 0422)</span>
        </label>
        <input
          id="phone"
          className="form-input"
          type="tel"
          inputMode="numeric"
          maxLength={11}
          placeholder="Ej: 04141234567 (opcional)"
          value={form.phone}
          onChange={(e) => {
            const clean = limpiarTelefonoInput(e.target.value);
            setForm((f) => ({ ...f, phone: clean }));
          }}
          style={{
            borderColor: form.phone
              ? validarTelefonoVenezolano(form.phone).isValid
                ? '#10b981'
                : form.phone.length >= 4 && !validarTelefonoVenezolano(form.phone).isPrefixValid
                ? '#e74c3c'
                : 'var(--border-gold)'
              : undefined,
          }}
        />
        {!form.phone ? (
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
            Puedes dejar este campo en blanco si la persona no tiene teléfono.
          </p>
        ) : (
          <div style={{ fontSize: '0.75rem', marginTop: '0.35rem' }}>
            {(() => {
              const val = validarTelefonoVenezolano(form.phone);
              if (val.isValid) {
                return (
                  <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                    ✓ Número válido ({form.phone.slice(0, 4)}-{form.phone.slice(4)})
                  </span>
                );
              }
              if (!val.isPrefixValid) {
                return (
                  <span style={{ color: '#e74c3c' }}>
                    ⚠️ Prefijo no válido. Debe comenzar con 0414, 0424, 0416, 0426, 0412 o 0422.
                  </span>
                );
              }
              return (
                <span style={{ color: '#f59e0b' }}>
                  Prefijo {val.prefix} ✓ — Faltan {11 - form.phone.length} dígitos ({form.phone.length}/11)
                </span>
              );
            })()}
          </div>
        )}
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
          onClick={() => setToast(null)}
          className={`toast toast-${toast.type === 'success' ? 'success' : 'error'}`}
          style={{
            position: 'fixed',
            top: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            animation: 'slide-in-right 0.3s ease',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
          title="Click para cerrar"
        >
          {toast.type === 'success' ? (
            <CheckCircle size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
          <span>{toast.msg}</span>
          <X size={14} style={{ marginLeft: '0.4rem', opacity: 0.7 }} />
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
            onClick={() => handleTabClick('home')}
            className={`btn ${activeTab === 'home' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
          >
            <Home size={18} />
            Inicio
          </button>
          <button 
            onClick={() => handleTabClick('list')}
            className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ justifyContent: 'space-between', padding: '0.75rem 1rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} />
              Mis Registros
            </div>
            {myMembers.length > 0 && (
              <span
                style={{
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  borderRadius: '12px',
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {myMembers.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => handleTabClick('seguimiento')}
            className={`btn ${activeTab === 'seguimiento' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ justifyContent: 'space-between', padding: '0.75rem 1rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Phone size={18} />
              Seguimiento
            </div>
            {pendingConsolidation.length > 0 && (
              <span
                style={{
                  background: 'var(--gold-primary)',
                  color: '#000',
                  borderRadius: '12px',
                  padding: '0.15rem 0.5rem',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {pendingConsolidation.length}
              </span>
            )}
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
              <div className="verse-banner" style={{ marginBottom: '2.5rem' }}>
                <p className="verse-text">&ldquo;{versiculo.texto}&rdquo;</p>
                <p className="verse-ref">
                  — {versiculo.referencia}
                </p>
              </div>
            )}

            {pendingConsolidation.length > 0 && (
              <div
                className="card"
                style={{
                  background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(0, 0, 0, 0.35))',
                  border: '1px solid var(--border-gold)',
                  borderRadius: '16px',
                  padding: '1.25rem 1.5rem',
                  marginBottom: '2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: 'var(--gold-primary)',
                      color: '#000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Bell size={22} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, color: 'var(--gold-primary)', fontSize: '1rem', margin: 0 }}>
                      ¡Tienes {pendingConsolidation.length} {pendingConsolidation.length === 1 ? 'persona pendiente' : 'personas pendientes'} de seguimiento!
                    </p>
                    <p className="text-secondary" style={{ fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
                      Recuerda realizar llamadas, visitas o mensajes de acompañamiento para su proceso de consolidación.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleTabClick('seguimiento')}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                >
                  Ver Seguimientos →
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h2 className="font-cinzel" style={{ fontSize: '1.2rem', margin: 0 }}>
                Tu Resumen de Registros
              </h2>
              <button
                onClick={openNewMember}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <Plus size={16} />
                <span>Nuevo Miembro</span>
              </button>
            </div>
            <div className="grid-6">
              <StatCard label="Total Registrados" value={stats.total} color="var(--gold-primary)" />
              <StatCard label="Nuevos" value={stats.nuevo} color="var(--color-nuevo)" />
              <StatCard label="Reconciliados" value={stats.reconciliado} color="var(--color-reconciliado)" />
              <StatCard label="Visitantes" value={stats.visitante} color="var(--color-visitante)" />
              <StatCard label="Consolidados" value={stats.consolidado} color="#10b981" />
              <StatCard label="Inactivos" value={stats.inactivo} color="var(--color-inactivo)" />
            </div>
          </div>
        )}

        {/* ── List Tab ── */}
        {activeTab === 'list' && (
          <div className="animate-fade-in" style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h2 className="font-cinzel" style={{ fontSize: '1.3rem', margin: 0 }}>Mis Registros</h2>
                <span className="badge badge-visitante">
                  {filteredMembers.length}{filteredMembers.length !== members.length ? ` de ${members.length}` : ''} miembro{members.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                onClick={openNewMember}
                className="btn btn-primary"
                id="open-new-member-modal-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1.15rem', fontSize: '0.88rem', fontWeight: 600 }}
              >
                <Plus size={16} />
                <span>Nuevo Miembro</span>
              </button>
            </div>

              {/* Buscador en tiempo real */}
              <div style={{ position: 'relative', marginBottom: '1.25rem', width: '100%' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--gold-primary)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  className="form-input"
                  type="text"
                  placeholder="Buscar por nombre, teléfono, municipio o estatus..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    padding: '0.65rem 2.2rem 0.65rem 2.5rem',
                    fontSize: '0.9rem',
                    width: '100%',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-gold)',
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    title="Limpiar búsqueda"
                  >
                    <X size={15} />
                  </button>
                )}
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
                  <button
                    onClick={openNewMember}
                    className="btn btn-primary"
                    style={{ marginTop: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                  >
                    <Plus size={16} />
                    <span>Registrar Miembro</span>
                  </button>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3.5rem 2rem', color: 'var(--text-muted)' }}>
                  <Search size={40} style={{ margin: '0 auto 1rem', opacity: 0.25 }} />
                  <p style={{ fontSize: '1.05rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                    No se encontraron registros para &ldquo;{search}&rdquo;
                  </p>
                  <button
                    onClick={() => setSearch('')}
                    className="btn btn-secondary"
                    style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}
                  >
                    Limpiar búsqueda
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {filteredMembers.map((m) => (
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {m.phone && (
                            <a
                              href={getWhatsAppUrl(
                                m.phone,
                                `Hola ${m.full_name}, Dios te bendiga 🙏. Te contacto de la Iglesia Avivamiento León de la Tribu de Judá.`
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary btn-icon"
                              style={{ width: 32, height: 32, color: '#25D366' }}
                              title="Contactar por WhatsApp"
                            >
                              <MessageCircle size={15} />
                            </a>
                          )}
                          <button
                            onClick={() => {
                              setSelectedFollowUpMember(m);
                              setActiveTab('seguimiento');
                            }}
                            className="btn btn-secondary btn-icon"
                            style={{ width: 32, height: 32, color: 'var(--gold-primary)', borderColor: 'var(--border-gold)' }}
                            title="Ficha de Seguimiento e Histórico"
                          >
                            <ClipboardList size={14} />
                          </button>
                          <button
                            onClick={() => startEdit(m)}
                            className="btn btn-secondary btn-icon"
                            style={{ width: 32, height: 32 }}
                            title="Editar miembro"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        {m.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            📞{' '}
                            <a
                              href={getWhatsAppUrl(
                                m.phone,
                                `Hola ${m.full_name}, Dios te bendiga 🙏. Te contacto de la Iglesia Avivamiento León de la Tribu de Judá.`
                              )}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'inherit', textDecoration: 'none' }}
                              title="Enviar WhatsApp"
                            >
                              {formatearTelefono(m.phone)}
                            </a>
                          </div>
                        )}
                        {(m.municipio || m.address) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            📍 {m.municipio ?? ''}{m.address ? (m.municipio ? ` — ${m.address}` : m.address) : ''}
                          </div>
                        )}
                        {m.age && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🗓 {m.age} años</div>}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                        <span className={`badge ${statusBadgeClass[m.status]}`}>{m.status}</span>

                        {m.is_consolidated ? (
                          <button
                            onClick={() => toggleConsolidado(m)}
                            className="badge"
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontSize: '0.75rem',
                              padding: '0.3rem 0.65rem',
                              cursor: 'pointer',
                            }}
                            title="Click para desmarcar consolidado si fue un error"
                          >
                            <CheckCircle size={13} />
                            Consolidado ✓
                          </button>
                        ) : (
                          consolidatingConfirmId === m.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <button
                                onClick={() => {
                                  toggleConsolidado(m);
                                  setConsolidatingConfirmId(null);
                                }}
                                className="btn btn-primary"
                                style={{
                                  fontSize: '0.72rem',
                                  padding: '0.28rem 0.65rem',
                                  background: '#10b981',
                                  borderColor: '#10b981',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                }}
                                title="Confirmar marcar como consolidado"
                              >
                                <Check size={12} />
                                ¿Confirmar?
                              </button>
                              <button
                                onClick={() => setConsolidatingConfirmId(null)}
                                className="btn btn-secondary btn-icon"
                                style={{ width: 26, height: 26 }}
                                title="Cancelar"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConsolidatingConfirmId(m.id)}
                              className="btn btn-secondary"
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.3rem 0.65rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                color: 'var(--gold-primary)',
                                borderColor: 'var(--border-gold)',
                              }}
                              title="Marcar persona como consolidada"
                            >
                              <CheckCircle size={13} />
                              Marcar Consolidado
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}

        {/* ── Seguimiento Tab ── */}
        {activeTab === 'seguimiento' && (
          selectedFollowUpMember ? (
            <MemberFollowUpSheet
              key={`followup-sheet-${selectedFollowUpMember.id}`}
              member={selectedFollowUpMember}
              profile={profile}
              profiles={profiles}
              onBack={() => setSelectedFollowUpMember(null)}
              onMemberUpdated={fetchMembers}
            />
          ) : (
            <div key="followup-list-main" className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h1 className="font-cinzel" style={{ fontSize: '1.5rem', margin: 0, color: 'var(--text-gold)' }}>
                    Seguimiento y Consolidación
                  </h1>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Histórico de llamadas, visitas presenciales y mensajes de acompañamiento pastoral.
                  </p>
                </div>
              </div>

              {/* Filtros */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ position: 'relative' }}>
                  <Search
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--gold-primary)',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Buscar miembro o teléfono..."
                    value={seguimientoSearch}
                    onChange={(e) => setSeguimientoSearch(e.target.value)}
                    style={{
                      padding: '0.65rem 1rem 0.65rem 2.6rem',
                      fontSize: '0.85rem',
                      width: '100%',
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                    }}
                  />
                </div>

                <select
                  className="form-select"
                  value={seguimientoFilter}
                  onChange={(e) => setSeguimientoFilter(e.target.value as any)}
                  style={{
                    padding: '0.65rem 1rem',
                    fontSize: '0.85rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                  }}
                >
                  <option value="mine">Todos mis miembros ({myMembers.length})</option>
                  <option value="pending">Mis pendientes de consolidar ({pendingConsolidation.length})</option>
                  <option value="consolidated">Mis consolidados ({stats.consolidado})</option>
                  <option value="inactivo">Inactivos ({stats.inactivo})</option>
                </select>
              </div>

              {/* Members cards */}
              {seguimientoList.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
                  <Phone size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                    No hay miembros en esta vista
                  </p>
                  <p style={{ fontSize: '0.82rem' }}>
                    No tienes registros en este filtro. Puedes registrar un nuevo miembro para iniciar su seguimiento.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {seguimientoList.map((m) => (
                    <div
                      key={m.id}
                      className="card-glass"
                      style={{
                        padding: '1.25rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        onClick={() => setSelectedFollowUpMember(m)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', cursor: 'pointer', flex: 1, minWidth: '220px' }}
                        title="Click para abrir Ficha de Seguimiento"
                      >
                        <div
                          className="avatar-placeholder"
                          style={{ width: 40, height: 40, fontSize: '0.9rem', flexShrink: 0, border: '1px solid var(--border-gold)' }}
                        >
                          {m.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                              {m.full_name}
                            </span>
                            <span className={`badge ${statusBadgeClass[m.status]}`} style={{ fontSize: '0.62rem' }}>
                              {m.status}
                            </span>
                          </div>
                          <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {m.phone ? formatearTelefono(m.phone) : 'Sin teléfono'} • {m.municipio || 'Nueva Esparta'}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {m.phone && (
                          <a
                            href={getWhatsAppUrl(
                              m.phone,
                              `Hola ${m.full_name}, Dios te bendiga 🙏. Te contacto de la Iglesia Avivamiento León de la Tribu de Judá.`
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-icon"
                            style={{ width: 34, height: 34, color: '#25D366' }}
                            title="Contactar por WhatsApp"
                          >
                            <MessageCircle size={15} />
                          </a>
                        )}

                        <button
                          onClick={() => setSelectedFollowUpMember(m)}
                          className="btn btn-primary"
                          style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem', gap: '0.4rem' }}
                        >
                          <ClipboardList size={14} />
                          Ficha de Seguimiento
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}
      </main>

      {/* ── Form Modal Flotante (Universal para todos los usuarios y pantallas) ── */}
      {showFormModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            animation: 'fade-in 0.2s ease',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) resetForm();
          }}
        >
          <div
            className="card-glass animate-bounce-in"
            style={{
              width: '100%',
              maxWidth: '520px',
              padding: '1.75rem',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '16px',
              border: '1px solid var(--border-gold)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.75)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.5rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <h2 className="font-cinzel" style={{ fontSize: '1.25rem', margin: 0, color: 'var(--text-gold)' }}>
                  {editingId ? 'Editar Miembro' : 'Nuevo Miembro'}
                </h2>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                  {editingId ? 'Modifica los datos del registro' : 'Registra los datos de la persona para su consolidación'}
                </p>
              </div>
              <button
                onClick={resetForm}
                className="btn btn-secondary btn-icon"
                style={{ width: 34, height: 34, borderRadius: '8px' }}
                title="Cerrar ventana"
              >
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
          onClick={() => handleTabClick('home')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', color: activeTab === 'home' ? 'var(--gold-primary)' : 'var(--text-muted)', cursor: 'pointer' }}
        >
          <Home size={20} />
          <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Inicio</span>
        </div>
        <div 
          onClick={() => handleTabClick('list')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', color: activeTab === 'list' ? 'var(--gold-primary)' : 'var(--text-muted)', cursor: 'pointer' }}
        >
          <Users size={20} />
          <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Registros</span>
        </div>
        <div 
          onClick={() => handleTabClick('seguimiento')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', color: activeTab === 'seguimiento' ? 'var(--gold-primary)' : 'var(--text-muted)', cursor: 'pointer' }}
        >
          <Phone size={20} />
          <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Seguimiento</span>
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
