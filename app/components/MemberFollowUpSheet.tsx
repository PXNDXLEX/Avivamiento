'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Member, Profile, Role, MemberFollowUp, FollowUpType } from '@/lib/types';
import { formatearTelefono, getWhatsAppUrl, formatearFechaInteraccion, formatearFecha } from '@/lib/utils';
import {
  ArrowLeft,
  Plus,
  Phone,
  MessageCircle,
  Home,
  FileText,
  Calendar,
  Clock,
  User,
  UserCheck,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Trash2,
  X,
  ExternalLink,
  Shield,
  MapPin,
  Sparkles,
  BarChart2,
  List,
  ChevronDown,
  Info,
} from 'lucide-react';

interface Props {
  member: Member;
  profile: Profile;
  profiles: Profile[];
  onBack: () => void;
  onMemberUpdated?: () => void;
}

const TYPE_CONFIG: Record<
  FollowUpType,
  {
    label: string;
    icon: any;
    color: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    defaultResults: string[];
  }
> = {
  visita: {
    label: 'VISITA PRESENCIAL',
    icon: Home,
    color: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeBorder: 'rgba(16, 185, 129, 0.4)',
    badgeText: '#10b981',
    defaultResults: [
      'Visita realizada con éxito',
      'Receptivo a la palabra',
      'No se encontraba en casa',
      'Requiere nueva visita',
      'Oración por petición familiar',
    ],
  },
  llamada: {
    label: 'LLAMADA TELEFÓNICA',
    icon: Phone,
    color: '#3b82f6',
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    badgeBorder: 'rgba(59, 130, 246, 0.4)',
    badgeText: '#3b82f6',
    defaultResults: [
      'Habló con el miembro (Contactado)',
      'Llamada de seguimiento semanal',
      'No contestó / Ocupado',
      'Dejó mensaje en buzón',
      'Número equivocado o apagado',
    ],
  },
  mensaje: {
    label: 'MENSAJE ENVIADO (WhatsApp)',
    icon: MessageCircle,
    color: '#25D366',
    badgeBg: 'rgba(37, 211, 102, 0.15)',
    badgeBorder: 'rgba(37, 211, 102, 0.4)',
    badgeText: '#25D366',
    defaultResults: [
      'Mensaje de bienvenida enviado',
      'Recordatorio de servicio dominical',
      'Entregado y Leído',
      'Mensaje respondido por el miembro',
      'Versículo y oración compartidos',
    ],
  },
  otro: {
    label: 'OTRO / NOTA DE SEGUIMIENTO',
    icon: FileText,
    color: '#C9A84C',
    badgeBg: 'rgba(201, 168, 76, 0.15)',
    badgeBorder: 'rgba(201, 168, 76, 0.4)',
    badgeText: '#C9A84C',
    defaultResults: [
      'Asistió a la iglesia el domingo',
      'Se integró a Casa de Dios',
      'Petición especial de oración',
      'Nota general de avance',
    ],
  },
};

export default function MemberFollowUpSheet({
  member,
  profile,
  profiles,
  onBack,
  onMemberUpdated,
}: Props) {
  const supabase = createClient();

  /* ── State ── */
  const [currentMember, setCurrentMember] = useState<Member>(member);
  const [followUps, setFollowUps] = useState<MemberFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'summary'>('timeline');

  /* Filters */
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  /* Modal Nueva Interacción */
  const [modalOpen, setModalOpen] = useState(false);
  const [formType, setFormType] = useState<FollowUpType>('llamada');
  const [formDate, setFormDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [formResult, setFormResult] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formDetail, setFormDetail] = useState('');
  const [markConsolidado, setMarkConsolidado] = useState(false);
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  /* Confirm Delete */
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* Toast local */
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  /* ── Storage helper key ── */
  const localKey = useMemo(() => `avivamiento_followups_${currentMember.id}`, [currentMember.id]);

  /* ── Load Follow-ups ── */
  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    let loadedFromSupabase = false;

    try {
      const { data, error } = await supabase
        .from('member_follow_ups')
        .select('*')
        .eq('member_id', currentMember.id)
        .order('date', { ascending: false });

      if (!error && data) {
        setFollowUps(data);
        loadedFromSupabase = true;
        // Sincronizar en localStorage como cache
        try {
          localStorage.setItem(localKey, JSON.stringify(data));
        } catch {}
      }
    } catch {
      // Si la tabla aún no existe en Supabase, recurrir a localStorage
    }

    if (!loadedFromSupabase) {
      try {
        const cached = localStorage.getItem(localKey);
        if (cached) {
          setFollowUps(JSON.parse(cached));
        } else {
          setFollowUps([]);
        }
      } catch {
        setFollowUps([]);
      }
    }

    setLoading(false);
  }, [supabase, currentMember.id, localKey]);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  /* Bloquear scroll de la página y cerrar con tecla ESC cuando el modal esté abierto */
  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [modalOpen]);

  /* ── Guardar Nueva Interacción ── */
  async function handleSaveInteraction(e: React.FormEvent) {
    e.preventDefault();
    if (!formDetail.trim()) {
      setErrorMsg('Por favor escribe el detalle de la interacción.');
      return;
    }

    setSavingInteraction(true);
    setErrorMsg('');

    const newFollowUp: MemberFollowUp = {
      id: crypto.randomUUID(),
      member_id: currentMember.id,
      user_id: profile.id,
      user_name: profile.full_name || profile.username || 'Usuario',
      type: formType,
      detail: formDetail.trim(),
      result_status: formResult.trim() || null,
      duration_mins: formDuration ? parseInt(formDuration, 10) : null,
      date: new Date(formDate).toISOString(),
      created_at: new Date().toISOString(),
    };

    let savedRemote = false;

    try {
      const { error } = await supabase.from('member_follow_ups').insert([newFollowUp]);
      if (!error) {
        savedRemote = true;
      }
    } catch {
      // Ignorar si la tabla no existe en Supabase todavía
    }

    // Actualizar estado local y cache en localStorage
    const updated = [newFollowUp, ...followUps].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    setFollowUps(updated);
    try {
      localStorage.setItem(localKey, JSON.stringify(updated));
    } catch {}

    // Si se marcó consolidar o cambiar condición
    if (markConsolidado && !currentMember.is_consolidated) {
      try {
        await supabase
          .from('members')
          .update({ is_consolidated: true, status: 'Consolidado' })
          .eq('id', currentMember.id);
        setCurrentMember((prev) => ({ ...prev, is_consolidated: true, status: 'Consolidado' }));
        if (onMemberUpdated) onMemberUpdated();
      } catch {}
    }

    setSavingInteraction(false);
    setModalOpen(false);
    setFormDetail('');
    setFormResult('');
    setFormDuration('');
    setMarkConsolidado(false);

    showToast(
      savedRemote
        ? 'Interacción registrada con éxito.'
        : 'Interacción guardada en este equipo (Recuerda ejecutar la migración SQL en Supabase).'
    );
  }

  /* ── Eliminar Interacción ── */
  async function handleDeleteInteraction(id: string) {
    try {
      await supabase.from('member_follow_ups').delete().eq('id', id);
    } catch {}

    const updated = followUps.filter((f) => f.id !== id);
    setFollowUps(updated);
    try {
      localStorage.setItem(localKey, JSON.stringify(updated));
    } catch {}

    setDeletingId(null);
    showToast('Interacción eliminada.');
  }

  /* ── Cambiar Estatus del Miembro Rápidamente ── */
  async function handleStatusChange(newStatus: Member['status']) {
    const isConsolidated = newStatus === 'Consolidado';
    try {
      const { error } = await supabase
        .from('members')
        .update({ status: newStatus, is_consolidated: isConsolidated })
        .eq('id', currentMember.id);

      if (!error) {
        setCurrentMember((prev) => ({ ...prev, status: newStatus, is_consolidated: isConsolidated }));
        showToast(`Estatus actualizado a ${newStatus}`);
        if (onMemberUpdated) onMemberUpdated();
      } else {
        showToast('Error al actualizar el estatus', 'error');
      }
    } catch {
      showToast('Error de conexión', 'error');
    }
  }

  /* ── Cambiar Consolidador Asignado (Admin / Principal) ── */
  async function handleConsolidatorChange(newConsolidatorId: string) {
    const chosen = profiles.find((p) => p.id === newConsolidatorId);
    if (!chosen) return;

    try {
      const { error } = await supabase
        .from('members')
        .update({
          consolidator_id: chosen.id,
          consolidator_name: chosen.full_name,
        })
        .eq('id', currentMember.id);

      if (!error) {
        setCurrentMember((prev) => ({
          ...prev,
          consolidator_id: chosen.id,
          consolidator_name: chosen.full_name,
        }));
        showToast(`Consolidador asignado: ${chosen.full_name}`);
        if (onMemberUpdated) onMemberUpdated();
      } else {
        showToast('Error al reasignar consolidador', 'error');
      }
    } catch {
      showToast('Error de conexión', 'error');
    }
  }

  /* ── Filtrado de Timeline ── */
  const filteredFollowUps = useMemo(() => {
    return followUps.filter((f) => {
      // Type filter
      if (typeFilter !== 'all' && f.type !== typeFilter) return false;

      // Date filter
      if (dateFilter !== 'all' && f.date) {
        const itemDate = new Date(f.date);
        const now = new Date();
        if (dateFilter === 'today') {
          if (itemDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'week') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (itemDate < sevenDaysAgo) return false;
        } else if (dateFilter === 'month') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (itemDate < thirtyDaysAgo) return false;
        } else if (dateFilter === 'year') {
          if (itemDate.getFullYear() !== now.getFullYear()) return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDetail = f.detail.toLowerCase().includes(q);
        const matchUser = f.user_name.toLowerCase().includes(q);
        const matchResult = (f.result_status || '').toLowerCase().includes(q);
        if (!matchDetail && !matchUser && !matchResult) return false;
      }

      return true;
    });
  }, [followUps, typeFilter, dateFilter, searchQuery]);

  /* Último contacto */
  const lastContactDate = useMemo(() => {
    if (followUps.length === 0) return 'Sin contacto previo';
    const sorted = [...followUps].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return formatearFecha(sorted[0].date);
  }, [followUps]);

  /* Estadísticas por tipo */
  const stats = useMemo(() => {
    return {
      total: followUps.length,
      visitas: followUps.filter((f) => f.type === 'visita').length,
      llamadas: followUps.filter((f) => f.type === 'llamada').length,
      mensajes: followUps.filter((f) => f.type === 'mensaje').length,
      otros: followUps.filter((f) => f.type === 'otro').length,
    };
  }, [followUps]);

  const canEditOrAssign = profile.role === 'principal' || profile.role === 'admin';

  return (
    <div className="animate-fade-in" style={{ width: '100%', paddingBottom: '3rem' }}>
      {/* Toast Notificación */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            background: toast.type === 'error' ? 'var(--fire-red)' : 'var(--gold-primary)',
            color: '#fff',
            padding: '0.8rem 1.4rem',
            borderRadius: '10px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          {toast.msg}
        </div>
      )}

      {/* ── TOP BAR DE NAVEGACIÓN ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-gold)',
        }}
      >
        <button
          onClick={onBack}
          className="btn btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            padding: '0.55rem 1.1rem',
            borderRadius: '8px',
          }}
        >
          <ArrowLeft size={16} />
          Volver a la lista
        </button>

        <div style={{ textAlign: 'center', flex: 1, minWidth: '240px' }}>
          <h2
            className="font-cinzel"
            style={{
              fontSize: '1.35rem',
              color: 'var(--text-gold)',
              letterSpacing: '1px',
              margin: 0,
            }}
          >
            FICHA DE SEGUIMIENTO DE MIEMBRO
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Historial de llamadas, visitas y contacto pastoral
          </span>
        </div>

        <button
          onClick={() => {
            setFormResult('');
            setFormDuration('');
            setFormDetail('');
            setErrorMsg('');
            setModalOpen(true);
          }}
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.25rem',
            fontSize: '0.9rem',
            borderRadius: '8px',
            fontWeight: 700,
          }}
        >
          <Plus size={16} />
          Nueva Interacción
        </button>
      </div>

      {/* ── TARJETA PRINCIPAL DEL MIEMBRO (HEADER RESUMEN) ── */}
      <div
        className="card"
        style={{
          padding: '1.8rem',
          marginBottom: '2rem',
          border: '1px solid var(--border-gold)',
          background: 'linear-gradient(145deg, var(--bg-card) 0%, rgba(201, 168, 76, 0.05) 100%)',
          borderRadius: '16px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.8rem',
            alignItems: 'center',
          }}
        >
          {/* Lado Izquierdo: Identidad y Contacto */}
          <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'flex-start' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--gold-dark), var(--gold-primary))',
                color: '#fff',
                fontSize: '1.5rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '2px solid var(--border-gold)',
                boxShadow: '0 4px 15px rgba(201, 168, 76, 0.3)',
              }}
            >
              {currentMember.full_name.charAt(0).toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <h3
                  className="font-cinzel"
                  style={{
                    fontSize: '1.35rem',
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  {currentMember.full_name}
                </h3>
              </div>

              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-gold)',
                  fontFamily: 'monospace',
                  marginTop: '0.2rem',
                  marginBottom: '0.6rem',
                }}
              >
                ID: #MEM-{currentMember.id.slice(0, 8).toUpperCase()}
              </div>

              {/* Teléfono & WhatsApp */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  marginBottom: '0.5rem',
                }}
              >
                {currentMember.phone ? (
                  <>
                    <a
                      href={`tel:${currentMember.phone}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      <Phone size={14} style={{ color: 'var(--gold-primary)' }} />
                      {formatearTelefono(currentMember.phone)}
                    </a>

                    <a
                      href={getWhatsAppUrl(
                        currentMember.phone,
                        `Hola ${currentMember.full_name}, Dios te bendiga 🙏. Te escribo de la Iglesia Avivamiento León de la Tribu de Judá.`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary"
                      style={{
                        background: '#25D366',
                        borderColor: '#25D366',
                        color: '#fff',
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                      title="Abrir chat en WhatsApp"
                    >
                      <MessageCircle size={13} />
                      WhatsApp
                    </a>
                  </>
                ) : (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Sin teléfono registrado
                  </span>
                )}
              </div>

              {/* Municipio & Dirección */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <MapPin size={13} style={{ color: 'var(--gold-primary)', flexShrink: 0 }} />
                <span>
                  {currentMember.municipio || 'Nueva Esparta'}
                  {currentMember.address ? ` — ${currentMember.address}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Lado Derecho: Estado, Consolidador y Último Contacto */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              paddingLeft: '1rem',
              borderLeft: '1px solid var(--border-subtle)',
            }}
          >
            {/* Estado actual interactivo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Estado actual:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className={`badge badge-${currentMember.status.toLowerCase()}`}>
                  {currentMember.status}
                </span>

                {/* Dropdown selector de estado rápido */}
                <select
                  value={currentMember.status}
                  onChange={(e) => handleStatusChange(e.target.value as Member['status'])}
                  style={{
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-gold)',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.4rem',
                    cursor: 'pointer',
                  }}
                  title="Cambiar estado del miembro"
                >
                  <option value="Nuevo">Nuevo</option>
                  <option value="Reconciliado">Reconciliado</option>
                  <option value="Visitante">Visitante</option>
                  <option value="Consolidado">Consolidado</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
            </div>

            {/* Asignado a */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Asignado a:</span>
              {canEditOrAssign ? (
                <select
                  value={currentMember.consolidator_id || ''}
                  onChange={(e) => handleConsolidatorChange(e.target.value)}
                  style={{
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-gold)',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    padding: '0.25rem 0.5rem',
                    maxWidth: '180px',
                  }}
                >
                  <option value="">Sin asignar</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.role === 'user' ? 'Consolidador' : p.role})
                    </option>
                  ))}
                </select>
              ) : (
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {currentMember.consolidator_name || 'Sin asignar'}
                </span>
              )}
            </div>

            {/* Último contacto */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Último contacto:</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-gold)' }}>
                {lastContactDate}
              </span>
            </div>

            {/* Contador de interacciones */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total interacciones:</span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '10px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#3b82f6',
                    fontWeight: 600,
                  }}
                  title="Llamadas"
                >
                  📞 {stats.llamadas}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    fontWeight: 600,
                  }}
                  title="Visitas"
                >
                  🏠 {stats.visitas}
                </span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '10px',
                    background: 'rgba(37, 211, 102, 0.15)',
                    color: '#25D366',
                    fontWeight: 600,
                  }}
                  title="Mensajes"
                >
                  💬 {stats.mensajes}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PESTAÑAS (Resumen vs Histórico Timeline) ── */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.75rem',
          marginBottom: '1.5rem',
        }}
      >
        <button
          onClick={() => setActiveTab('timeline')}
          className={`btn ${activeTab === 'timeline' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1.2rem',
            borderRadius: '20px',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          <List size={15} />
          Histórico de Seguimiento ({followUps.length})
        </button>

        <button
          onClick={() => setActiveTab('summary')}
          className={`btn ${activeTab === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1.2rem',
            borderRadius: '20px',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          <BarChart2 size={15} />
          Resumen y Estadísticas
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════
          VISTA 1: TIMELINE DE SEGUIMIENTO (Línea de tiempo)
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'timeline' && (
        <div className="animate-fade-in">
          {/* BARRA DE FILTROS Y BÚSQUEDA */}
          <div
            className="card"
            style={{
              padding: '1rem 1.4rem',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
              background: 'var(--bg-secondary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Filter size={15} style={{ color: 'var(--gold-primary)' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  FILTRAR POR:
                </span>
              </div>

              {/* Selector de Tipo */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-gold)',
                  borderRadius: '6px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <option value="all">Todos los tipos</option>
                <option value="llamada">Llamadas Telefónicas</option>
                <option value="visita">Visitas Presenciales</option>
                <option value="mensaje">Mensajes (WhatsApp)</option>
                <option value="otro">Otros / Notas</option>
              </select>

              {/* Selector de Fecha */}
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-gold)',
                  borderRadius: '6px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                <option value="all">Todas las fechas</option>
                <option value="today">Hoy</option>
                <option value="week">Últimos 7 días</option>
                <option value="month">Últimos 30 días</option>
                <option value="year">Este año</option>
              </select>
            </div>

            {/* Buscador en notas */}
            <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 240px', maxWidth: '380px' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: '0.85rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--gold-primary)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Buscar en notas o responsable..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '0.45rem 0.8rem 0.45rem 2.4rem',
                  fontSize: '0.85rem',
                  width: '100%',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-card)',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '0.6rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* LISTADO / TIMELINE DE INTERACCIONES */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
              <h4
                className="font-cinzel"
                style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0 }}
              >
                HISTORIAL DE INTERACCIONES (Línea de Tiempo)
              </h4>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Mostrando {filteredFollowUps.length} de {followUps.length} registros
              </span>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <Clock size={32} style={{ margin: '0 auto 1rem', opacity: 0.3, animation: 'spin 2s linear infinite' }} />
                <p>Cargando historial de seguimiento...</p>
              </div>
            ) : filteredFollowUps.length === 0 ? (
              <div
                className="card"
                style={{
                  textAlign: 'center',
                  padding: '3.5rem 1.5rem',
                  color: 'var(--text-muted)',
                  border: '1px dashed var(--border-gold)',
                  background: 'rgba(201, 168, 76, 0.02)',
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'rgba(201, 168, 76, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem',
                    color: 'var(--gold-primary)',
                  }}
                >
                  <Clock size={28} />
                </div>
                <h5 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {followUps.length === 0
                    ? 'No hay interacciones registradas aún'
                    : 'No hay interacciones que coincidan con los filtros'}
                </h5>
                <p style={{ fontSize: '0.85rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
                  {followUps.length === 0
                    ? 'Registra las llamadas, visitas y mensajes de WhatsApp realizados para mantener el control pastoral de este miembro.'
                    : 'Intenta cambiar el tipo de interacción o el rango de fecha en los filtros superiores.'}
                </p>
                <button
                  onClick={() => setModalOpen(true)}
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
                >
                  <Plus size={15} style={{ marginRight: '0.4rem' }} />
                  Registrar Primera Interacción
                </button>
              </div>
            ) : (
              <div
                style={{
                  position: 'relative',
                  paddingLeft: '2.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem',
                }}
              >
                {/* Línea vertical del timeline */}
                <div
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    bottom: '1rem',
                    left: '1.15rem',
                    width: '2px',
                    background: 'linear-gradient(180deg, var(--gold-primary) 0%, rgba(201, 168, 76, 0.2) 100%)',
                  }}
                />

                {filteredFollowUps.map((item) => {
                  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.otro;
                  const IconComponent = cfg.icon;

                  return (
                    <div
                      key={item.id}
                      className="card"
                      style={{
                        position: 'relative',
                        padding: '1.4rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-card)',
                        transition: 'transform 0.2s ease, border-color 0.2s ease',
                      }}
                    >
                      {/* Nodo circular del timeline */}
                      <div
                        style={{
                          position: 'absolute',
                          left: '-2.5rem',
                          top: '1.4rem',
                          width: '2.3rem',
                          height: '2.3rem',
                          borderRadius: '50%',
                          background: cfg.badgeBg,
                          border: `2px solid ${cfg.color}`,
                          color: cfg.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: `0 0 12px ${cfg.color}40`,
                          transform: 'translateX(-50%)',
                          zIndex: 2,
                        }}
                      >
                        <IconComponent size={14} />
                      </div>

                      {/* Encabezado del item */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          flexWrap: 'wrap',
                          marginBottom: '0.75rem',
                          paddingBottom: '0.6rem',
                          borderBottom: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '0.92rem',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {formatearFechaInteraccion(item.date)}
                          </span>

                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>|</span>

                          <span
                            style={{
                              fontSize: '0.82rem',
                              color: 'var(--text-secondary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <UserCheck size={13} style={{ color: 'var(--gold-primary)' }} />
                            Registrado por: <strong style={{ color: 'var(--text-primary)' }}>{item.user_name}</strong>
                          </span>
                        </div>

                        {/* Botón de eliminar interacción */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {deletingId === item.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <button
                                onClick={() => handleDeleteInteraction(item.id)}
                                className="btn btn-danger"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="btn btn-secondary"
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.4rem' }}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingId(item.id)}
                              style={{
                                color: 'var(--text-muted)',
                                padding: '0.2rem',
                                borderRadius: '4px',
                                transition: 'color 0.2s',
                              }}
                              title="Eliminar registro"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Badge de Tipo */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.25rem 0.65rem',
                            borderRadius: '6px',
                            background: cfg.badgeBg,
                            border: `1px solid ${cfg.badgeBorder}`,
                            color: cfg.badgeText,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.5px',
                          }}
                        >
                          <IconComponent size={12} />
                          {cfg.label}
                        </span>

                        {item.result_status && (
                          <span
                            style={{
                              padding: '0.25rem 0.6rem',
                              borderRadius: '6px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-secondary)',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                            }}
                          >
                            Resultado: <strong>{item.result_status}</strong>
                          </span>
                        )}

                        {item.duration_mins && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.25rem 0.55rem',
                              borderRadius: '6px',
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-muted)',
                              fontSize: '0.75rem',
                            }}
                          >
                            <Clock size={12} />
                            Duración: {item.duration_mins} min{item.duration_mins > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Detalle / Comentario del Seguimiento */}
                      <div
                        style={{
                          background: 'var(--bg-secondary)',
                          borderLeft: `3px solid ${cfg.color}`,
                          padding: '0.85rem 1.1rem',
                          borderRadius: '0 8px 8px 0',
                          fontSize: '0.9rem',
                          color: 'var(--text-primary)',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {item.detail}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          VISTA 2: RESUMEN Y ESTADÍSTICAS DEL MIEMBRO
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'summary' && (
        <div className="animate-fade-in">
          {/* Métricas de contacto */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.2rem',
              marginBottom: '2rem',
            }}
          >
            <div className="card" style={{ padding: '1.3rem', textAlign: 'center' }}>
              <div style={{ color: 'var(--gold-primary)', fontSize: '2rem', fontWeight: 800 }}>
                {stats.total}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Total Interacciones
              </div>
            </div>

            <div className="card" style={{ padding: '1.3rem', textAlign: 'center' }}>
              <div style={{ color: '#3b82f6', fontSize: '2rem', fontWeight: 800 }}>
                {stats.llamadas}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Llamadas Telefónicas
              </div>
            </div>

            <div className="card" style={{ padding: '1.3rem', textAlign: 'center' }}>
              <div style={{ color: '#10b981', fontSize: '2rem', fontWeight: 800 }}>
                {stats.visitas}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Visitas Presenciales
              </div>
            </div>

            <div className="card" style={{ padding: '1.3rem', textAlign: 'center' }}>
              <div style={{ color: '#25D366', fontSize: '2rem', fontWeight: 800 }}>
                {stats.mensajes}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Mensajes WhatsApp
              </div>
            </div>
          </div>

          {/* Información completa de registro */}
          <div className="card" style={{ padding: '1.8rem' }}>
            <h4 className="font-cinzel" style={{ fontSize: '1.1rem', marginBottom: '1.2rem' }}>
              Detalles del Registro
            </h4>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1.2rem',
              }}
            >
              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Fecha de Ingreso:</span>
                <p style={{ fontWeight: 600, marginTop: '0.2rem' }}>
                  {formatearFecha(currentMember.created_at)}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Género:</span>
                <p style={{ fontWeight: 600, marginTop: '0.2rem' }}>
                  {currentMember.gender || 'No especificado'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Edad:</span>
                <p style={{ fontWeight: 600, marginTop: '0.2rem' }}>
                  {currentMember.age ? `${currentMember.age} años` : 'No registrada'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Consolidación:</span>
                <p style={{ fontWeight: 600, marginTop: '0.2rem', color: currentMember.is_consolidated ? '#10b981' : 'var(--text-muted)' }}>
                  {currentMember.is_consolidated ? '✓ Miembro Consolidado' : 'En proceso de seguimiento'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL / VENTANA EMERGENTE: + NUEVA INTERACCIÓN
      ══════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            className="modal-content card-glass animate-bounce-in"
            style={{
              maxWidth: '580px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              border: '1px solid var(--border-gold)',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.8), 0 0 24px rgba(201, 168, 76, 0.25)',
              borderRadius: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '1rem',
                borderBottom: '1px solid var(--border-gold)',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <h3 className="font-cinzel" style={{ fontSize: '1.2rem', margin: 0, color: 'var(--text-gold)' }}>
                  Nueva Interacción de Seguimiento
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Para: <strong style={{ color: 'var(--text-primary)' }}>{currentMember.full_name}</strong>
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {errorMsg && (
              <div
                style={{
                  background: 'rgba(192, 57, 43, 0.15)',
                  border: '1px solid var(--fire-red)',
                  color: 'var(--fire-red)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveInteraction}>
              {/* SELECTOR VISUAL DE TIPO */}
              <div style={{ marginBottom: '1.2rem' }}>
                <label className="form-label" style={{ marginBottom: '0.6rem', display: 'block', fontWeight: 600 }}>
                  Tipo de Interacción *
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '0.75rem',
                  }}
                >
                  {(['llamada', 'visita', 'mensaje', 'otro'] as FollowUpType[]).map((t) => {
                    const cfg = TYPE_CONFIG[t];
                    const IconComponent = cfg.icon;
                    const isSelected = formType === t;

                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setFormType(t);
                          setFormResult('');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.8rem',
                          borderRadius: '8px',
                          border: isSelected ? `2px solid ${cfg.color}` : '1px solid var(--border-subtle)',
                          background: isSelected ? cfg.badgeBg : 'var(--bg-secondary)',
                          color: isSelected ? cfg.color : 'var(--text-primary)',
                          cursor: 'pointer',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.85rem',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: isSelected ? cfg.color : 'rgba(255,255,255,0.06)',
                            color: isSelected ? '#fff' : cfg.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <IconComponent size={14} />
                        </div>
                        <span>{t === 'llamada' ? 'Llamada' : t === 'visita' ? 'Visita' : t === 'mensaje' ? 'WhatsApp' : 'Otro / Nota'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* FECHA Y HORA & DURACIÓN */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: formType === 'llamada' || formType === 'visita' ? '1.5fr 1fr' : '1fr',
                  gap: '1rem',
                  marginBottom: '1.2rem',
                }}
              >
                <div>
                  <label className="form-label" style={{ marginBottom: '0.4rem', display: 'block', fontSize: '0.82rem' }}>
                    Fecha y Hora *
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                {(formType === 'llamada' || formType === 'visita') && (
                  <div>
                    <label className="form-label" style={{ marginBottom: '0.4rem', display: 'block', fontSize: '0.82rem' }}>
                      Duración (minutos)
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Ej. 8"
                      className="form-input"
                      value={formDuration}
                      onChange={(e) => setFormDuration(e.target.value)}
                      style={{ width: '100%', fontSize: '0.85rem' }}
                    />
                  </div>
                )}
              </div>

              {/* RESULTADO / ESTATUS */}
              <div style={{ marginBottom: '1.2rem' }}>
                <label className="form-label" style={{ marginBottom: '0.4rem', display: 'block', fontSize: '0.82rem' }}>
                  Resultado o Estatus de la interacción
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  {TYPE_CONFIG[formType].defaultResults.slice(0, 3).map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setFormResult(res)}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        background: formResult === res ? 'var(--gold-primary)' : 'var(--bg-secondary)',
                        color: formResult === res ? '#fff' : 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                      }}
                    >
                      {res}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej. Contactado, Receptivo, Oración por salud..."
                  value={formResult}
                  onChange={(e) => setFormResult(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                />
              </div>

              {/* DETALLE / NOTAS */}
              <div style={{ marginBottom: '1.4rem' }}>
                <label className="form-label" style={{ marginBottom: '0.4rem', display: 'block', fontSize: '0.82rem', fontWeight: 600 }}>
                  Detalle de la conversación o visita *
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="Escribe lo conversado con el miembro, peticiones de oración, acuerdos o inquietudes manifestadas..."
                  value={formDetail}
                  onChange={(e) => setFormDetail(e.target.value)}
                  required
                  style={{ width: '100%', fontSize: '0.88rem', resize: 'vertical' }}
                />
              </div>

              {/* MARCAR CONSOLIDADO SI CORRESPONDE */}
              {!currentMember.is_consolidated && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '8px',
                    marginBottom: '1.5rem',
                  }}
                >
                  <input
                    type="checkbox"
                    id="chkConsolidado"
                    checked={markConsolidado}
                    onChange={(e) => setMarkConsolidado(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#10b981', cursor: 'pointer' }}
                  />
                  <label htmlFor="chkConsolidado" style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600, cursor: 'pointer' }}>
                    ¿Marcar este miembro como Consolidado con esta interacción?
                  </label>
                </div>
              )}

              {/* BOTONES ACCIÓN */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={savingInteraction}
                  style={{ padding: '0.55rem 1.2rem', fontSize: '0.88rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingInteraction}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.55rem 1.4rem',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                  }}
                >
                  <Plus size={16} />
                  {savingInteraction ? 'Guardando...' : 'Guardar Interacción'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
