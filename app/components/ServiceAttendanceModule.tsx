'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Member, Profile, ChurchService, HouseGroup } from '@/lib/types';
import { formatearFechaServicio, getWhatsAppUrl, formatearTelefono } from '@/lib/utils';
import {
  Calendar,
  CalendarCheck,
  Users,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  ArrowLeft,
  Check,
  X,
  AlertCircle,
  Copy,
  Download,
  BarChart2,
  CheckSquare,
  Square,
  MessageCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Home,
  ChevronDown,
} from 'lucide-react';

interface Props {
  profile: Profile;
  supabase: SupabaseClient;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onNavigateToMembers?: () => void;
  houseGroups?: HouseGroup[];
  initialCasaId?: string | null;
  onNavigateToAssign?: () => void;
}

interface ServiceWithCount extends ChurchService {
  attendees_count: number;
}

interface AttendeeItem {
  attendance_id: string;
  member_id: string;
  member: Member;
  created_at: string;
}

const COMMON_SERVICES = [
  'Servicio Dominical',
  'Servicio de Oración',
  'Servicio de Jóvenes',
  'Servicio de Damas',
  'Servicio de Caballeros',
  'Culto de Adoración',
  'Vigilia de Poder',
  'Servicio Especial',
];

const LOCAL_STORAGE_KEY_SERVICES = 'avivamiento_local_services';
const LOCAL_STORAGE_KEY_ATTENDANCES = 'avivamiento_local_service_attendances';

export default function ServiceAttendanceModule({
  profile,
  supabase,
  showToast,
  onNavigateToMembers,
  houseGroups: propsHouseGroups,
  initialCasaId,
  onNavigateToAssign,
}: Props) {
  /* ── Mode / View ── */
  const [view, setView] = useState<'report' | 'register'>('report');

  /* ── Casas de Dios data ── */
  const [casas, setCasas] = useState<HouseGroup[]>(propsHouseGroups ?? []);
  const [selectedCasaId, setSelectedCasaId] = useState<string | null>(initialCasaId ?? null);

  /* ── Services data ── */
  const [services, setServices] = useState<ServiceWithCount[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [dbTableMissing, setDbTableMissing] = useState(false);

  /* ── Members data (ALL members: active, inactive, consolidated, visitors, etc.) ── */
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  /* ── Register / Edit Form State ── */
  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [serviceName, setServiceName] = useState('Servicio Dominical');
  const [customServiceName, setCustomServiceName] = useState('');
  const [isCustomName, setIsCustomName] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  /* ── Attendance Selection State ── */
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [originalMemberIds, setOriginalMemberIds] = useState<Set<string>>(new Set());
  const [savingAttendance, setSavingAttendance] = useState(false);

  /* ── Search & Filter for Members ── */
  const [memberSearch, setMemberSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Nuevo' | 'Reconciliado' | 'Visitante' | 'Consolidado' | 'Inactivo'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active_only' | 'inactive_only'>('all');
  const [selectionFilter, setSelectionFilter] = useState<'all' | 'selected' | 'unselected'>('all');

  /* ── Report Filter & Search ── */
  const [reportSearch, setReportSearch] = useState('');
  const [reportDateFilter, setReportDateFilter] = useState<'all' | 'month' | 'year'>('all');

  /* ── Modal: View Service Attendees ── */
  const [viewingService, setViewingService] = useState<ServiceWithCount | null>(null);
  const [serviceAttendees, setServiceAttendees] = useState<AttendeeItem[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState('');

  /* ── Modal: Delete Confirmation ── */
  const [serviceToDelete, setServiceToDelete] = useState<ServiceWithCount | null>(null);
  const [deletingService, setDeletingService] = useState(false);

  /* ── Modal: SQL helper ── */
  const [showSqlModal, setShowSqlModal] = useState(false);

  /* ── Synchronize Casas from props or fetch if not present ── */
  useEffect(() => {
    if (initialCasaId) {
      setSelectedCasaId(initialCasaId);
    }
  }, [initialCasaId]);

  useEffect(() => {
    if (propsHouseGroups && propsHouseGroups.length > 0) {
      setCasas(propsHouseGroups);
      if (!selectedCasaId || !propsHouseGroups.some((h) => h.id === selectedCasaId)) {
        const nextId = initialCasaId && propsHouseGroups.some((h) => h.id === initialCasaId)
          ? initialCasaId
          : propsHouseGroups[0].id;
        setSelectedCasaId(nextId);
      }
    } else {
      // Fetch Casas from Supabase directly
      supabase
        .from('house_groups')
        .select('*')
        .order('name', { ascending: true })
        .then(({ data }) => {
          if (data && data.length > 0) {
            setCasas(data);
            if (!selectedCasaId || !data.some((h) => h.id === selectedCasaId)) {
              const nextId = initialCasaId && data.some((h) => h.id === initialCasaId)
                ? initialCasaId
                : data[0].id;
              setSelectedCasaId(nextId);
            }
          }
        });
    }
  }, [propsHouseGroups, initialCasaId, selectedCasaId, supabase]);

  /* ── Active selected Casa de Dios ── */
  const selectedCasa = useMemo(() => {
    return casas.find((c) => c.id === selectedCasaId) ?? null;
  }, [casas, selectedCasaId]);

  /* ── Members of ONLY the selected Casa de Dios ── */
  const casaMembers = useMemo(() => {
    if (!selectedCasaId) return [];
    return allMembers.filter((m) => m.house_group_id === selectedCasaId);
  }, [allMembers, selectedCasaId]);

  /* ── Effective service name ── */
  const effectiveServiceName = useMemo(() => {
    if (isCustomName) return customServiceName.trim() || 'Servicio General';
    return serviceName;
  }, [isCustomName, customServiceName, serviceName]);

  /* ── 1. Fetch All Members ── */
  const fetchMembersList = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) {
        console.warn('Error fetching all members from Supabase:', error);
      }
      setAllMembers(data ?? []);
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoadingMembers(false);
    }
  }, [supabase]);

  /* ── 2. Fetch Services & Attendance counts ── */
  const fetchServicesList = useCallback(async () => {
    setLoadingServices(true);
    let supabaseSuccess = false;

    try {
      // Consultar servicios
      const { data: servicesData, error: sError } = await supabase
        .from('church_services')
        .select('*')
        .order('date', { ascending: false });

      if (!sError && servicesData) {
        supabaseSuccess = true;
        setDbTableMissing(false);

        // Consultar conteos de asistencia
        const { data: attendancesData, error: aError } = await supabase
          .from('service_attendances')
          .select('service_id');

        const countsMap: Record<string, number> = {};
        if (!aError && attendancesData) {
          attendancesData.forEach((att: { service_id: string }) => {
            countsMap[att.service_id] = (countsMap[att.service_id] || 0) + 1;
          });
        }

        const merged: ServiceWithCount[] = servicesData.map((s) => ({
          ...s,
          attendees_count: countsMap[s.id] || 0,
        }));

        setServices(merged);
      } else if (sError && (sError.code === '42P01' || sError.message?.includes('does not exist'))) {
        setDbTableMissing(true);
      }
    } catch (err) {
      console.warn('Supabase church_services query exception:', err);
      setDbTableMissing(true);
    }

    // Fallback a LocalStorage si la tabla aún no existe
    if (!supabaseSuccess && typeof window !== 'undefined') {
      try {
        const rawServices = localStorage.getItem(LOCAL_STORAGE_KEY_SERVICES);
        const rawAtts = localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCES);

        const localServices: ChurchService[] = rawServices ? JSON.parse(rawServices) : [];
        const localAtts: { service_id: string; member_id: string }[] = rawAtts ? JSON.parse(rawAtts) : [];

        const countsMap: Record<string, number> = {};
        localAtts.forEach((att) => {
          countsMap[att.service_id] = (countsMap[att.service_id] || 0) + 1;
        });

        const merged: ServiceWithCount[] = localServices.map((s) => ({
          ...s,
          attendees_count: countsMap[s.id] || 0,
        }));

        merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setServices(merged);
      } catch (e) {
        console.error('Error loading local storage fallback:', e);
      }
    }

    setLoadingServices(false);
  }, [supabase]);

  useEffect(() => {
    fetchMembersList();
    fetchServicesList();
  }, [fetchMembersList, fetchServicesList]);

  /* ── 3. Load attendance for a specific service into editor ── */
  const loadServiceForEditing = useCallback(
    async (service: ServiceWithCount) => {
      setEditingServiceId(service.id);
      setServiceDate(service.date);

      if (service.house_group_id && service.house_group_id !== selectedCasaId) {
        setSelectedCasaId(service.house_group_id);
      }

      if (COMMON_SERVICES.includes(service.name)) {
        setServiceName(service.name);
        setIsCustomName(false);
        setCustomServiceName('');
      } else {
        setIsCustomName(true);
        setCustomServiceName(service.name);
      }

      let memberIds = new Set<string>();
      try {
        const { data, error } = await supabase
          .from('service_attendances')
          .select('member_id')
          .eq('service_id', service.id);

        if (!error && data) {
          memberIds = new Set(data.map((d: { member_id: string }) => d.member_id));
        } else if (typeof window !== 'undefined') {
          const rawAtts = localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCES);
          if (rawAtts) {
            const list: { service_id: string; member_id: string }[] = JSON.parse(rawAtts);
            memberIds = new Set(list.filter((a) => a.service_id === service.id).map((a) => a.member_id));
          }
        }
      } catch {
        // Ignorar error
      }

      setSelectedMemberIds(memberIds);
      setOriginalMemberIds(new Set(memberIds));
      setView('register');
    },
    [supabase, selectedCasaId]
  );

  /* ── 4. Open new service register ── */
  const startNewService = () => {
    if (!selectedCasaId) {
      showToast('Selecciona primero una Casa de Dios para registrar su asistencia', 'error');
      return;
    }
    setEditingServiceId(null);
    setServiceDate(new Date().toISOString().split('T')[0]);
    setServiceName('Servicio Dominical');
    setIsCustomName(false);
    setCustomServiceName('');
    setSelectedMemberIds(new Set());
    setOriginalMemberIds(new Set());
    setMemberSearch('');
    setStatusFilter('all');
    setActiveFilter('all');
    setSelectionFilter('all');
    setView('register');
  };

  /* ── 5. Check if service already exists for this Casa and Date ── */
  const existingServiceMatch = useMemo(() => {
    if (!effectiveServiceName || !serviceDate || !selectedCasaId) return null;
    return services.find(
      (s) =>
        s.name.trim().toLowerCase() === effectiveServiceName.trim().toLowerCase() &&
        s.date === serviceDate &&
        (s.house_group_id === selectedCasaId || !s.house_group_id)
    );
  }, [services, effectiveServiceName, serviceDate, selectedCasaId]);

  /* ── 6. Filter Members list (ONLY OF THIS CASA DE DIOS) ── */
  const filteredMembers = useMemo(() => {
    return casaMembers.filter((m) => {
      // Búsqueda por nombre o teléfono
      if (memberSearch.trim()) {
        const query = memberSearch.toLowerCase().trim();
        const matchesName = m.full_name?.toLowerCase().includes(query);
        const matchesPhone = m.phone?.toLowerCase().includes(query);
        const matchesMunicipio = m.municipio?.toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesMunicipio) return false;
      }

      // Filtro por Estado
      if (statusFilter !== 'all' && m.status !== statusFilter) {
        return false;
      }

      // Filtro por Activo / Inactivo
      const isInactive = Boolean(m.deleted_at) || m.status === 'Inactivo';
      if (activeFilter === 'active_only' && isInactive) return false;
      if (activeFilter === 'inactive_only' && !isInactive) return false;

      // Filtro por Estado de Selección
      const isSelected = selectedMemberIds.has(m.id);
      if (selectionFilter === 'selected' && !isSelected) return false;
      if (selectionFilter === 'unselected' && isSelected) return false;

      return true;
    });
  }, [casaMembers, memberSearch, statusFilter, activeFilter, selectionFilter, selectedMemberIds]);

  /* ── 7. Toggle member selection ── */
  const toggleMemberSelection = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  /* ── Quick selection actions ── */
  const selectAllFiltered = () => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      filteredMembers.forEach((m) => next.add(m.id));
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      filteredMembers.forEach((m) => next.delete(m.id));
      return next;
    });
  };

  const clearAllSelection = () => {
    setSelectedMemberIds(new Set());
  };

  /* ── 8. Save Attendance ── */
  const handleSaveAttendance = async () => {
    if (!selectedCasaId) {
      showToast('Selecciona una Casa de Dios válida', 'error');
      return;
    }
    if (!effectiveServiceName.trim()) {
      showToast('Por favor ingresa un nombre para el servicio', 'error');
      return;
    }
    if (!serviceDate) {
      showToast('Por favor selecciona una fecha para el servicio', 'error');
      return;
    }

    setSavingAttendance(true);

    try {
      let targetServiceId = editingServiceId;

      if (!targetServiceId) {
        // Verificar si ya existe en Supabase para esta Casa + Nombre + Fecha
        let findQuery = supabase
          .from('church_services')
          .select('id')
          .eq('name', effectiveServiceName.trim())
          .eq('date', serviceDate);

        if (selectedCasaId) {
          findQuery = findQuery.eq('house_group_id', selectedCasaId);
        }

        const { data: existing } = await findQuery.maybeSingle();

        if (existing?.id) {
          targetServiceId = existing.id;
        } else {
          // Crear nuevo servicio vinculado a la Casa de Dios
          const insertPayload: any = {
            name: effectiveServiceName.trim(),
            date: serviceDate,
            created_by: profile.id,
          };
          if (selectedCasaId) {
            insertPayload.house_group_id = selectedCasaId;
          }

          const { data: created, error: createError } = await supabase
            .from('church_services')
            .insert(insertPayload)
            .select('id')
            .single();

          if (!createError && created?.id) {
            targetServiceId = created.id;
          }
        }
      } else {
        // Actualizar servicio existente
        const updatePayload: any = {
          name: effectiveServiceName.trim(),
          date: serviceDate,
        };
        if (selectedCasaId) {
          updatePayload.house_group_id = selectedCasaId;
        }

        await supabase
          .from('church_services')
          .update(updatePayload)
          .eq('id', targetServiceId);
      }

      if (targetServiceId) {
        const toAdd = Array.from(selectedMemberIds).filter((id) => !originalMemberIds.has(id));
        const toRemove = Array.from(originalMemberIds).filter((id) => !selectedMemberIds.has(id));

        if (toRemove.length > 0) {
          await supabase
            .from('service_attendances')
            .delete()
            .eq('service_id', targetServiceId)
            .in('member_id', toRemove);
        }

        if (toAdd.length > 0) {
          const insertPayload = toAdd.map((memberId) => ({
            service_id: targetServiceId,
            member_id: memberId,
            created_by: profile.id,
          }));

          const { error: insertErr } = await supabase
            .from('service_attendances')
            .insert(insertPayload);

          if (insertErr) {
            console.warn('Error inserting attendances:', insertErr);
          }
        }

        showToast(`¡Asistencia guardada con éxito! (${selectedMemberIds.size} personas registradas)`);
      } else {
        // Fallback LocalStorage
        const localServiceId = editingServiceId || `local_serv_${Date.now()}`;
        const rawServices = localStorage.getItem(LOCAL_STORAGE_KEY_SERVICES);
        const listServices: ChurchService[] = rawServices ? JSON.parse(rawServices) : [];

        const existingIdx = listServices.findIndex((s) => s.id === localServiceId);
        const serviceObj: ChurchService = {
          id: localServiceId,
          house_group_id: selectedCasaId,
          name: effectiveServiceName.trim(),
          date: serviceDate,
          created_at: new Date().toISOString(),
          created_by: profile.id,
        };

        if (existingIdx >= 0) {
          listServices[existingIdx] = serviceObj;
        } else {
          listServices.push(serviceObj);
        }
        localStorage.setItem(LOCAL_STORAGE_KEY_SERVICES, JSON.stringify(listServices));

        const rawAtts = localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCES);
        let listAtts: { service_id: string; member_id: string; created_at: string }[] = rawAtts
          ? JSON.parse(rawAtts)
          : [];

        listAtts = listAtts.filter((a) => a.service_id !== localServiceId);

        selectedMemberIds.forEach((mId) => {
          listAtts.push({
            service_id: localServiceId,
            member_id: mId,
            created_at: new Date().toISOString(),
          });
        });

        localStorage.setItem(LOCAL_STORAGE_KEY_ATTENDANCES, JSON.stringify(listAtts));
        showToast(`Asistencia guardada localmente (${selectedMemberIds.size} personas).`);
      }

      await fetchServicesList();
      setView('report');
    } catch (err: any) {
      console.error('Error guardando asistencia:', err);
      showToast('Ocurrió un error al guardar la asistencia', 'error');
    } finally {
      setSavingAttendance(false);
    }
  };

  /* ── 9. View Attendees Modal ── */
  const handleOpenAttendeesModal = async (service: ServiceWithCount) => {
    setViewingService(service);
    setLoadingAttendees(true);
    setAttendeeSearch('');

    try {
      const { data, error } = await supabase
        .from('service_attendances')
        .select(`
          id,
          member_id,
          created_at,
          member:members(*)
        `)
        .eq('service_id', service.id);

      if (!error && data) {
        const mapped: AttendeeItem[] = data.map((d: any) => ({
          attendance_id: d.id,
          member_id: d.member_id,
          member: d.member,
          created_at: d.created_at,
        }));
        setServiceAttendees(mapped);
      } else if (typeof window !== 'undefined') {
        const rawAtts = localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCES);
        if (rawAtts) {
          const list: { id?: string; service_id: string; member_id: string; created_at?: string }[] = JSON.parse(rawAtts);
          const attsOfServ = list.filter((a) => a.service_id === service.id);
          const mapped: AttendeeItem[] = attsOfServ
            .map((a) => {
              const mem = allMembers.find((m) => m.id === a.member_id);
              if (!mem) return null;
              return {
                attendance_id: a.id || `att_${a.member_id}`,
                member_id: a.member_id,
                member: mem,
                created_at: a.created_at || new Date().toISOString(),
              };
            })
            .filter(Boolean) as AttendeeItem[];
          setServiceAttendees(mapped);
        }
      }
    } catch (e) {
      console.error('Error loading attendees:', e);
    } finally {
      setLoadingAttendees(false);
    }
  };

  /* ── 10. Delete Service ── */
  const handleDeleteService = async () => {
    if (!serviceToDelete) return;
    setDeletingService(true);

    try {
      const { error } = await supabase
        .from('church_services')
        .delete()
        .eq('id', serviceToDelete.id);

      if (error) {
        console.warn('Error deleting in Supabase:', error);
      }

      if (typeof window !== 'undefined') {
        const rawServices = localStorage.getItem(LOCAL_STORAGE_KEY_SERVICES);
        if (rawServices) {
          const list: ChurchService[] = JSON.parse(rawServices);
          localStorage.setItem(LOCAL_STORAGE_KEY_SERVICES, JSON.stringify(list.filter((s) => s.id !== serviceToDelete.id)));
        }
        const rawAtts = localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCES);
        if (rawAtts) {
          const list: { service_id: string }[] = JSON.parse(rawAtts);
          localStorage.setItem(LOCAL_STORAGE_KEY_ATTENDANCES, JSON.stringify(list.filter((a) => a.service_id !== serviceToDelete.id)));
        }
      }

      showToast(`Servicio "${serviceToDelete.name}" eliminado correctamente`);
      setServiceToDelete(null);
      await fetchServicesList();
    } catch (err) {
      showToast('Error al eliminar el servicio', 'error');
    } finally {
      setDeletingService(false);
    }
  };

  /* ── Filtered Report Services for ONLY this selected Casa de Dios ── */
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      // Filtrar por la Casa de Dios seleccionada
      if (selectedCasaId) {
        // Si el servicio tiene house_group_id, debe coincidir
        if (s.house_group_id && s.house_group_id !== selectedCasaId) {
          return false;
        }
      }

      if (reportSearch.trim()) {
        const q = reportSearch.toLowerCase().trim();
        const matchName = s.name.toLowerCase().includes(q);
        const matchDate = s.date.includes(q);
        if (!matchName && !matchDate) return false;
      }

      if (reportDateFilter === 'month') {
        const now = new Date();
        const servDate = new Date(s.date + 'T12:00:00Z');
        if (servDate.getMonth() !== now.getMonth() || servDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      } else if (reportDateFilter === 'year') {
        const now = new Date();
        const servDate = new Date(s.date + 'T12:00:00Z');
        if (servDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      }

      return true;
    });
  }, [services, selectedCasaId, reportSearch, reportDateFilter]);

  /* ── Report KPI Calculations for this Casa de Dios ── */
  const kpis = useMemo(() => {
    const totalServices = filteredServices.length;
    const totalAttendances = filteredServices.reduce((acc, s) => acc + s.attendees_count, 0);
    const avgAttendance = totalServices > 0 ? Math.round(totalAttendances / totalServices) : 0;
    const maxAttendanceService = filteredServices.reduce(
      (max, s) => (s.attendees_count > (max?.attendees_count || 0) ? s : max),
      null as ServiceWithCount | null
    );

    return {
      totalServices,
      totalAttendances,
      avgAttendance,
      maxAttendanceService,
    };
  }, [filteredServices]);

  /* ── Filtered Attendees in Modal ── */
  const filteredAttendees = useMemo(() => {
    if (!attendeeSearch.trim()) return serviceAttendees;
    const q = attendeeSearch.toLowerCase().trim();
    return serviceAttendees.filter((item) => {
      const name = item.member?.full_name?.toLowerCase() || '';
      const phone = item.member?.phone?.toLowerCase() || '';
      const status = item.member?.status?.toLowerCase() || '';
      return name.includes(q) || phone.includes(q) || status.includes(q);
    });
  }, [serviceAttendees, attendeeSearch]);

  /* ── Copy Attendees list to clipboard ── */
  const copyAttendeesList = () => {
    if (!viewingService || serviceAttendees.length === 0) return;
    const lines = [
      `📋 ASISTENCIA: ${viewingService.name.toUpperCase()}`,
      `🏠 Casa de Dios: ${selectedCasa?.name || 'General'}`,
      `📅 Fecha: ${formatearFechaServicio(viewingService.date)}`,
      `👥 Total Asistentes: ${serviceAttendees.length}`,
      '──────────────────────────────',
      ...serviceAttendees.map((a, i) => `${i + 1}. ${a.member?.full_name || 'Miembro'} (${a.member?.status || 'Registrado'})`),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    showToast('¡Lista de asistentes copiada al portapapeles!');
  };

  /* ── Export Report to CSV ── */
  const exportReportCsv = () => {
    if (filteredServices.length === 0) {
      showToast('No hay servicios para exportar', 'error');
      return;
    }
    const headers = ['Casa de Dios', 'Fecha', 'Servicio', 'Cantidad de Asistentes'];
    const rows = filteredServices.map((s) => [
      `"${selectedCasa?.name || 'Casa de Dios'}"`,
      `"${s.date}"`,
      `"${s.name}"`,
      s.attendees_count,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `asistencia_${selectedCasa?.name || 'casa'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Reporte exportado en formato CSV');
  };

  /* ── SQL Script text for copy ── */
  const sqlScript = `-- Ejecuta este script en el Editor SQL de tu proyecto Supabase:

ALTER TABLE public.church_services 
  ADD COLUMN IF NOT EXISTS house_group_id UUID REFERENCES public.house_groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_church_services_house_group_id 
  ON public.church_services(house_group_id);

ALTER TABLE public.church_services 
  DROP CONSTRAINT IF EXISTS uq_church_service_name_date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_church_service_casa_name_date'
  ) THEN
    ALTER TABLE public.church_services 
      ADD CONSTRAINT uq_church_service_casa_name_date UNIQUE (house_group_id, name, date);
  END IF;
END $$;`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      {/* ── Banner if Supabase table is not yet created ── */}
      {dbTableMissing && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.12), rgba(201, 168, 76, 0.08))',
            borderColor: 'rgba(234, 179, 8, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            padding: '1rem 1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={22} color="var(--gold-primary)" style={{ flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Configuración en Supabase pendiente
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                La columna de Casa de Dios en servicios aún no ha sido agregada. Haz clic en el botón para ver el script SQL.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSqlModal(true)}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
          >
            Ver Script SQL
          </button>
        </div>
      )}

      {/* ── Selector de Casa de Dios ── */}
      <div
        className="card"
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'linear-gradient(135deg, rgba(201, 168, 76, 0.08) 0%, rgba(0, 0, 0, 0.25) 100%)',
          border: '1px solid var(--border-gold)',
          borderRadius: 'var(--border-radius-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: 'rgba(201, 168, 76, 0.15)',
              border: '1px solid rgba(201, 168, 76, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--gold-primary)',
              flexShrink: 0,
            }}
          >
            <Home size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--gold-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Casa de Dios
              </span>
              {selectedCasa && (
                <span className="badge badge-consolidado" style={{ fontSize: '0.65rem' }}>
                  👥 {casaMembers.length} {casaMembers.length === 1 ? 'integrante' : 'integrantes'}
                </span>
              )}
            </div>
            <h3 style={{ margin: '0.15rem 0 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              {selectedCasa ? selectedCasa.name : 'Selecciona una Casa de Dios'}
            </h3>
            {selectedCasa && (
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {selectedCasa.address || 'Sin dirección'}{selectedCasa.municipio ? ` • ${selectedCasa.municipio}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Dropdown selector de Casa de Dios */}
        {casas.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Seleccionar Casa:
            </label>
            <select
              value={selectedCasaId || ''}
              onChange={(e) => {
                setSelectedCasaId(e.target.value);
                if (view === 'register') {
                  setView('report');
                  setSelectedMemberIds(new Set());
                }
              }}
              style={{
                padding: '0.55rem 1rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-gold)',
                borderRadius: 'var(--border-radius)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                fontWeight: 600,
                minWidth: '220px',
                cursor: 'pointer',
              }}
            >
              {casas.map((casa) => {
                const count = allMembers.filter((m) => m.house_group_id === casa.id).length;
                return (
                  <option key={casa.id} value={casa.id}>
                    🏠 {casa.name} ({count} integrantes)
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* Si no hay ninguna Casa de Dios creada */}
      {casas.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--border-radius)',
            border: '1px dashed var(--border-subtle)',
          }}
        >
          <Home size={44} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
            No hay Casas de Dios creadas aún
          </h3>
          <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Para llevar la asistencia de los servicios, primero debes crear al menos una Casa de Dios en la sub-pestaña "Gestionar Casas".
          </p>
        </div>
      ) : (
        <>
          {/* ── Header con Navegación de Vistas ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, rgba(201,168,76,0.2) 0%, rgba(201,168,76,0.05) 100%)',
                    border: '1px solid rgba(201,168,76,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--gold-primary)',
                  }}
                >
                  <CalendarCheck size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Asistencia de Servicios: {selectedCasa?.name || 'Casa de Dios'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Registros y reportes vinculados a esta Casa de Dios
                  </p>
                </div>
              </div>
            </div>

            {/* Action button to switch view */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {view === 'report' ? (
                <button
                  onClick={startNewService}
                  className="btn btn-primary"
                  style={{ gap: '0.5rem', padding: '0.65rem 1.25rem' }}
                >
                  <Plus size={18} />
                  Registrar Asistencia
                </button>
              ) : (
                <button
                  onClick={() => setView('report')}
                  className="btn btn-secondary"
                  style={{ gap: '0.5rem', padding: '0.65rem 1.25rem' }}
                >
                  <ArrowLeft size={16} />
                  Volver al Reporte
                </button>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              VISTA 1: REPORTE DE SERVICIOS DE ESTA CASA DE DIOS
              ═══════════════════════════════════════════════════════════════ */}
          {view === 'report' && (
            <>
              {/* ── KPI Cards ── */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                }}
              >
                {/* Card 1: Servicios Realizados */}
                <div className="card-metric">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Servicios Realizados
                      </span>
                      <span className="font-cinzel" style={{ fontSize: '2.4rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                        {kpis.totalServices}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        En esta Casa de Dios
                      </span>
                    </div>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '12px',
                        background: 'rgba(201, 168, 76, 0.12)',
                        border: '1px solid rgba(201, 168, 76, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--gold-primary)',
                        flexShrink: 0,
                      }}
                    >
                      <CalendarCheck size={22} />
                    </div>
                  </div>
                </div>

                {/* Card 2: Asistencias Totales */}
                <div className="card-metric">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Asistencias Totales
                      </span>
                      <span className="font-cinzel" style={{ fontSize: '2.4rem', fontWeight: 700, color: 'var(--gold-primary)', lineHeight: 1 }}>
                        {kpis.totalAttendances}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Personas acumuladas
                      </span>
                    </div>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '12px',
                        background: 'rgba(201, 168, 76, 0.12)',
                        border: '1px solid rgba(201, 168, 76, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--gold-primary)',
                        flexShrink: 0,
                      }}
                    >
                      <Users size={22} />
                    </div>
                  </div>
                </div>

                {/* Card 3: Promedio por Servicio */}
                <div className="card-metric">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Promedio por Servicio
                      </span>
                      <span className="font-cinzel" style={{ fontSize: '2.4rem', fontWeight: 700, color: '#3b82f6', lineHeight: 1 }}>
                        {kpis.avgAttendance}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Asistentes por reunión
                      </span>
                    </div>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '12px',
                        background: 'rgba(59, 130, 246, 0.12)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#3b82f6',
                        flexShrink: 0,
                      }}
                    >
                      <BarChart2 size={22} />
                    </div>
                  </div>
                </div>

                {/* Card 4: Mayor Asistencia */}
                <div className="card-metric">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', minWidth: 0 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Mayor Asistencia
                      </span>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                        <span className="font-cinzel" style={{ fontSize: '2.4rem', fontWeight: 700, color: '#10b981', lineHeight: 1 }}>
                          {kpis.maxAttendanceService ? kpis.maxAttendanceService.attendees_count : 0}
                        </span>
                        <span style={{ fontSize: '0.9rem', color: '#10b981', fontWeight: 700 }}>pers.</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {kpis.maxAttendanceService ? kpis.maxAttendanceService.name : 'Sin registros'}
                      </span>
                    </div>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '12px',
                        background: 'rgba(16, 185, 129, 0.12)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#10b981',
                        flexShrink: 0,
                      }}
                    >
                      <Sparkles size={22} />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Filtros y Búsqueda del Reporte ── */}
              <div
                className="card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                    <Search
                      size={16}
                      style={{
                        position: 'absolute',
                        left: '0.9rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Buscar servicio por nombre o fecha..."
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                      style={{
                        width: '100%',
                        paddingLeft: '2.5rem',
                        paddingRight: '1rem',
                        paddingTop: '0.65rem',
                        paddingBottom: '0.65rem',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--border-radius)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>

                  {/* Botones de Filtro Temporal */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      onClick={() => setReportDateFilter('all')}
                      className={`btn ${reportDateFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setReportDateFilter('month')}
                      className={`btn ${reportDateFilter === 'month' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
                    >
                      Este Mes
                    </button>
                    <button
                      onClick={() => setReportDateFilter('year')}
                      className={`btn ${reportDateFilter === 'year' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
                    >
                      Este Año
                    </button>

                    <button
                      onClick={exportReportCsv}
                      className="btn btn-secondary"
                      title="Exportar reporte a CSV"
                      style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem', gap: '0.35rem' }}
                    >
                      <Download size={14} />
                      CSV
                    </button>
                  </div>
                </div>

                {/* ── Tabla de Reporte de Servicios ── */}
                {loadingServices ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem' }} />
                    <p style={{ margin: 0 }}>Cargando reporte de servicios...</p>
                  </div>
                ) : filteredServices.length === 0 ? (
                  <div
                    style={{
                      padding: '3.5rem 1.5rem',
                      textAlign: 'center',
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--border-radius)',
                      border: '1px dashed var(--border-subtle)',
                    }}
                  >
                    <CalendarCheck size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                      No hay servicios registrados para esta Casa de Dios
                    </h4>
                    <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Comienza registrando la asistencia del primer servicio para {selectedCasa?.name || 'esta Casa'}.
                    </p>
                    <button onClick={startNewService} className="btn btn-primary" style={{ gap: '0.5rem' }}>
                      <Plus size={16} />
                      Registrar Asistencia a un Servicio
                    </button>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Servicio</th>
                          <th style={{ textAlign: 'center' }}>Cantidad de Personas</th>
                          <th style={{ textAlign: 'right' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredServices.map((service) => (
                          <tr key={service.id}>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {formatearFechaServicio(service.date)}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {service.date}
                                </span>
                              </div>
                            </td>

                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: 'var(--gold-primary)',
                                    display: 'inline-block',
                                  }}
                                />
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                  {service.name}
                                </span>
                              </div>
                            </td>

                            <td style={{ textAlign: 'center' }}>
                              <span
                                className="badge"
                                style={{
                                  background: 'rgba(201, 168, 76, 0.15)',
                                  color: 'var(--gold-primary)',
                                  border: '1px solid rgba(201, 168, 76, 0.35)',
                                  fontSize: '0.85rem',
                                  padding: '0.35rem 0.85rem',
                                  fontWeight: 700,
                                  borderRadius: '20px',
                                }}
                              >
                                👥 {service.attendees_count} {service.attendees_count === 1 ? 'persona' : 'personas'}
                              </span>
                            </td>

                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                                <button
                                  onClick={() => handleOpenAttendeesModal(service)}
                                  className="btn btn-secondary"
                                  title="Ver lista de personas asistentes"
                                  style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem', gap: '0.35rem' }}
                                >
                                  <Users size={14} />
                                  Ver Personas
                                </button>

                                <button
                                  onClick={() => loadServiceForEditing(service)}
                                  className="btn btn-secondary"
                                  title="Editar / Modificar asistencia"
                                  style={{ padding: '0.45rem 0.75rem', fontSize: '0.78rem', gap: '0.35rem' }}
                                >
                                  <Edit2 size={14} />
                                  Modificar
                                </button>

                                <button
                                  onClick={() => setServiceToDelete(service)}
                                  className="btn btn-danger"
                                  title="Eliminar este servicio"
                                  style={{ padding: '0.45rem 0.6rem' }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              VISTA 2: REGISTRO / EDICIÓN DE ASISTENCIA A UN SERVICIO
              ═══════════════════════════════════════════════════════════════ */}
          {view === 'register' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* ── Tarjeta: Identificación del Servicio (Servicio + Fecha) ── */}
              <div
                className="card"
                style={{
                  padding: '1.5rem',
                  borderTop: '3px solid var(--gold-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                    {editingServiceId ? '✏️ Modificar Asistencia del Servicio' : '✨ Nuevo Registro de Asistencia'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Servicio vinculado a: <strong style={{ color: 'var(--gold-primary)' }}>{selectedCasa?.name}</strong>
                  </p>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1.25rem',
                  }}
                >
                  {/* Selector de Fecha */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.45rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      📅 Fecha del Servicio
                    </label>
                    <input
                      type="date"
                      value={serviceDate}
                      onChange={(e) => setServiceDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--border-radius)',
                        color: 'var(--text-primary)',
                        fontSize: '0.9rem',
                        fontWeight: 500,
                      }}
                    />
                    <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.75rem', color: 'var(--gold-primary)' }}>
                      {formatearFechaServicio(serviceDate)}
                    </p>
                  </div>

                  {/* Selector de Nombre del Servicio */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.45rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      ⛪ Servicio
                    </label>

                    {!isCustomName ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <select
                          value={serviceName}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              setIsCustomName(true);
                              setCustomServiceName('');
                            } else {
                              setServiceName(e.target.value);
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: '0.65rem 0.85rem',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--border-radius)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                          }}
                        >
                          {COMMON_SERVICES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                          <option value="__custom__">✏️ Otro / Escribir nombre personalizado...</option>
                        </select>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder="Ej: Culto Especial, Conferencia..."
                          value={customServiceName}
                          onChange={(e) => setCustomServiceName(e.target.value)}
                          autoFocus
                          style={{
                            flex: 1,
                            padding: '0.65rem 0.85rem',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-focus)',
                            borderRadius: 'var(--border-radius)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setIsCustomName(false)}
                          className="btn btn-secondary"
                          title="Volver a lista común"
                          style={{ padding: '0.65rem' }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}

                    {/* Chips rápidos */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.6rem' }}>
                      {COMMON_SERVICES.slice(0, 4).map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => {
                            setServiceName(chip);
                            setIsCustomName(false);
                          }}
                          style={{
                            border: '1px solid var(--border-subtle)',
                            background:
                              !isCustomName && serviceName === chip
                                ? 'rgba(201, 168, 76, 0.2)'
                                : 'var(--bg-tertiary)',
                            color:
                              !isCustomName && serviceName === chip
                                ? 'var(--gold-primary)'
                                : 'var(--text-secondary)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            fontWeight: !isCustomName && serviceName === chip ? 700 : 400,
                          }}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {existingServiceMatch && !editingServiceId && (
                  <div
                    style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: 'var(--border-radius)',
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                      fontSize: '0.82rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span>
                      ℹ️ Ya existe un registro para <strong>{existingServiceMatch.name}</strong> el <strong>{existingServiceMatch.date}</strong> con {existingServiceMatch.attendees_count} asistentes en esta Casa de Dios.
                    </span>
                    <button
                      type="button"
                      onClick={() => loadServiceForEditing(existingServiceMatch)}
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    >
                      Cargar y Editar
                    </button>
                  </div>
                )}
              </div>

              {/* ── Tarjeta: Selector de Personas (SOLO INTEGRANTES DE ESTA CASA DE DIOS) ── */}
              <div
                className="card"
                style={{
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Users size={18} color="var(--gold-primary)" />
                      Integrantes de {selectedCasa?.name}
                    </h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Mostrando únicamente los miembros asignados a esta Casa de Dios (incluye activos e inactivos).
                    </p>
                  </div>

                  {/* Contador */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      background: 'rgba(201, 168, 76, 0.12)',
                      border: '1px solid rgba(201, 168, 76, 0.35)',
                      borderRadius: '25px',
                      padding: '0.5rem 1.15rem',
                    }}
                  >
                    <CheckSquare size={18} color="var(--gold-primary)" />
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selectedMemberIds.size}{' '}
                      <span style={{ fontWeight: 500, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        de {casaMembers.length} integrantes
                      </span>
                    </span>
                  </div>
                </div>

                {casaMembers.length === 0 ? (
                  <div
                    style={{
                      padding: '2.5rem 1.5rem',
                      textAlign: 'center',
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--border-radius)',
                      border: '1px dashed var(--border-gold)',
                    }}
                  >
                    <Users size={36} color="var(--gold-primary)" style={{ margin: '0 auto 0.75rem', opacity: 0.5 }} />
                    <h4 style={{ margin: '0 0 0.4rem', color: 'var(--text-primary)' }}>
                      Esta Casa de Dios no tiene integrantes asignados aún
                    </h4>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Para registrar la asistencia a este servicio, primero debes asignar miembros a la Casa de Dios "{selectedCasa?.name}".
                    </p>
                    {onNavigateToAssign && (
                      <button
                        onClick={onNavigateToAssign}
                        className="btn btn-primary"
                        style={{ gap: '0.4rem', margin: '0 auto', fontSize: '0.85rem' }}
                      >
                        <Users size={15} />
                        Ir a Asignar Miembros
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Buscador y Filtros */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ position: 'relative', width: '100%' }}>
                        <Search
                          size={16}
                          style={{
                            position: 'absolute',
                            left: '0.9rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)',
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Buscar por nombre o teléfono entre los integrantes de esta casa..."
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          style={{
                            width: '100%',
                            paddingLeft: '2.5rem',
                            paddingRight: memberSearch ? '2.5rem' : '1rem',
                            paddingTop: '0.7rem',
                            paddingBottom: '0.7rem',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--border-radius)',
                            color: 'var(--text-primary)',
                            fontSize: '0.9rem',
                          }}
                        />
                        {memberSearch && (
                          <button
                            onClick={() => setMemberSearch('')}
                            style={{
                              position: 'absolute',
                              right: '0.75rem',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                            }}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>

                      {/* Filtros de estado */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.65rem',
                        }}
                      >
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {(['all', 'Nuevo', 'Reconciliado', 'Visitante', 'Consolidado'] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setStatusFilter(st)}
                              style={{
                                padding: '0.3rem 0.65rem',
                                fontSize: '0.75rem',
                                borderRadius: '6px',
                                border: '1px solid',
                                borderColor: statusFilter === st ? 'var(--gold-primary)' : 'var(--border-subtle)',
                                background: statusFilter === st ? 'rgba(201, 168, 76, 0.18)' : 'var(--bg-secondary)',
                                color: statusFilter === st ? 'var(--gold-primary)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontWeight: statusFilter === st ? 600 : 400,
                              }}
                            >
                              {st === 'all' ? 'Todos los estados' : st}
                            </button>
                          ))}
                        </div>

                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => setActiveFilter('all')}
                            style={{
                              padding: '0.3rem 0.6rem',
                              fontSize: '0.75rem',
                              borderRadius: '6px',
                              border: '1px solid',
                              borderColor: activeFilter === 'all' ? 'var(--gold-primary)' : 'var(--border-subtle)',
                              background: activeFilter === 'all' ? 'rgba(201, 168, 76, 0.15)' : 'var(--bg-secondary)',
                              color: activeFilter === 'all' ? 'var(--gold-primary)' : 'var(--text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            Activos e Inactivos
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveFilter(activeFilter === 'inactive_only' ? 'all' : 'inactive_only')}
                            style={{
                              padding: '0.3rem 0.6rem',
                              fontSize: '0.75rem',
                              borderRadius: '6px',
                              border: '1px solid',
                              borderColor: activeFilter === 'inactive_only' ? '#ef4444' : 'var(--border-subtle)',
                              background: activeFilter === 'inactive_only' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-secondary)',
                              color: activeFilter === 'inactive_only' ? '#ef4444' : 'var(--text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            Solo Inactivos
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectionFilter(selectionFilter === 'selected' ? 'all' : 'selected')}
                            style={{
                              padding: '0.3rem 0.65rem',
                              fontSize: '0.75rem',
                              borderRadius: '6px',
                              border: '1px solid',
                              borderColor: selectionFilter === 'selected' ? '#10b981' : 'var(--border-subtle)',
                              background: selectionFilter === 'selected' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-secondary)',
                              color: selectionFilter === 'selected' ? '#10b981' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            ✓ Ver Seleccionados ({selectedMemberIds.size})
                          </button>
                        </div>
                      </div>

                      {/* Botones de Selección Masiva */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                          padding: '0.6rem 0.85rem',
                          background: 'var(--bg-tertiary)',
                          borderRadius: 'var(--border-radius)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={selectAllFiltered}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', gap: '0.3rem' }}
                          >
                            <CheckSquare size={14} />
                            Seleccionar filtrados ({filteredMembers.length})
                          </button>

                          <button
                            type="button"
                            onClick={deselectAllFiltered}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', gap: '0.3rem' }}
                          >
                            <Square size={14} />
                            Deseleccionar filtrados
                          </button>

                          {selectedMemberIds.size > 0 && (
                            <button
                              type="button"
                              onClick={clearAllSelection}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: '0.2rem 0.4rem',
                              }}
                            >
                              Limpiar toda la selección
                            </button>
                          )}
                        </div>

                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Mostrando {filteredMembers.length} de {casaMembers.length} integrantes de esta casa
                        </span>
                      </div>
                    </div>

                    {/* Lista Seleccionable de Miembros */}
                    {loadingMembers ? (
                      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.75rem' }} />
                        <p>Cargando integrantes...</p>
                      </div>
                    ) : filteredMembers.length === 0 ? (
                      <div
                        style={{
                          padding: '2.5rem 1rem',
                          textAlign: 'center',
                          background: 'var(--bg-secondary)',
                          borderRadius: 'var(--border-radius)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <Users size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                        <p style={{ margin: 0, fontWeight: 500 }}>No se encontraron integrantes con los filtros seleccionados.</p>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                          gap: '0.65rem',
                          maxHeight: '480px',
                          overflowY: 'auto',
                          paddingRight: '0.35rem',
                        }}
                      >
                        {filteredMembers.map((member) => {
                          const isSelected = selectedMemberIds.has(member.id);
                          const isInactive = Boolean(member.deleted_at) || member.status === 'Inactivo';

                          return (
                            <div
                              key={member.id}
                              onClick={() => toggleMemberSelection(member.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.75rem 0.9rem',
                                borderRadius: 'var(--border-radius)',
                                border: '1px solid',
                                borderColor: isSelected
                                  ? 'var(--gold-primary)'
                                  : isInactive
                                  ? 'rgba(239, 68, 68, 0.25)'
                                  : 'var(--border-subtle)',
                                background: isSelected
                                  ? 'linear-gradient(135deg, rgba(201, 168, 76, 0.14) 0%, rgba(201, 168, 76, 0.04) 100%)'
                                  : isInactive
                                  ? 'rgba(239, 68, 68, 0.03)'
                                  : 'var(--bg-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: isSelected ? '0 2px 8px rgba(201, 168, 76, 0.15)' : 'none',
                              }}
                            >
                              <div
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: '6px',
                                  border: `2px solid ${isSelected ? 'var(--gold-primary)' : 'var(--border-focus)'}`,
                                  background: isSelected ? 'var(--gold-primary)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {isSelected && <Check size={14} color="#000" strokeWidth={3} />}
                              </div>

                              <div
                                className="avatar-placeholder"
                                style={{
                                  width: 32,
                                  height: 32,
                                  fontSize: '0.8rem',
                                  background: isSelected ? 'rgba(201,168,76,0.3)' : 'var(--bg-tertiary)',
                                  color: isSelected ? 'var(--gold-primary)' : 'var(--text-secondary)',
                                  flexShrink: 0,
                                }}
                              >
                                {member.full_name?.charAt(0).toUpperCase() || 'M'}
                              </div>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p
                                  style={{
                                    margin: 0,
                                    fontWeight: isSelected ? 700 : 500,
                                    fontSize: '0.88rem',
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {member.full_name}
                                </p>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                                  <span
                                    className={`badge badge-${member.status?.toLowerCase() || 'nuevo'}`}
                                    style={{ fontSize: '0.62rem', padding: '0.1rem 0.4rem' }}
                                  >
                                    {member.status || 'Nuevo'}
                                  </span>

                                  {isInactive && (
                                    <span
                                      style={{
                                        fontSize: '0.62rem',
                                        padding: '0.1rem 0.4rem',
                                        borderRadius: '4px',
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        color: '#ef4444',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        fontWeight: 600,
                                      }}
                                    >
                                      Inactivo
                                    </span>
                                  )}

                                  {member.phone && (
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                      • {formatearTelefono(member.phone)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Barra de Guardar Asistencia */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        borderTop: '1px solid var(--border-subtle)',
                        paddingTop: '1.25rem',
                        marginTop: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          Total a guardar en {selectedCasa?.name}: <strong style={{ color: 'var(--gold-primary)', fontSize: '1.05rem' }}>{selectedMemberIds.size} integrantes</strong>
                        </span>
                        {editingServiceId && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            (Previamente había {originalMemberIds.size})
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => setView('report')}
                          className="btn btn-secondary"
                          disabled={savingAttendance}
                        >
                          Cancelar
                        </button>

                        <button
                          type="button"
                          onClick={handleSaveAttendance}
                          className="btn btn-primary"
                          disabled={savingAttendance || !effectiveServiceName.trim() || !serviceDate}
                          style={{ gap: '0.5rem', padding: '0.7rem 1.6rem', fontSize: '0.95rem', fontWeight: 700 }}
                        >
                          {savingAttendance ? (
                            <>
                              <RefreshCw size={18} className="animate-spin" />
                              Guardando Asistencia...
                            </>
                          ) : (
                            <>
                              <Check size={18} />
                              Guardar Asistencia ({selectedMemberIds.size})
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              MODAL: VER LISTA DE ASISTENTES DE UN SERVICIO
              ═══════════════════════════════════════════════════════════════ */}
          {viewingService && (
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
              }}
              onClick={(e) => e.target === e.currentTarget && setViewingService(null)}
            >
              <div
                className="card-glass"
                style={{
                  width: '100%',
                  maxWidth: '620px',
                  padding: '1.75rem',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                }}
              >
                {/* Header del Modal */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--gold-primary)',
                        fontWeight: 700,
                      }}
                    >
                      Asistentes del Servicio • {selectedCasa?.name}
                    </span>
                    <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {viewingService.name}
                    </h3>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      📅 {formatearFechaServicio(viewingService.date)}
                    </p>
                  </div>

                  <button
                    onClick={() => setViewingService(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '0.35rem',
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Total Badge & Quick Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    background: 'var(--bg-secondary)',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--border-radius)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={18} color="var(--gold-primary)" />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      {serviceAttendees.length} personas asistieron
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      onClick={copyAttendeesList}
                      className="btn btn-secondary"
                      title="Copiar lista al portapapeles"
                      style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', gap: '0.35rem' }}
                    >
                      <Copy size={13} />
                      Copiar Nombres
                    </button>

                    <button
                      onClick={() => {
                        const s = viewingService;
                        setViewingService(null);
                        loadServiceForEditing(s);
                      }}
                      className="btn btn-primary"
                      style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', gap: '0.35rem' }}
                    >
                      <Edit2 size={13} />
                      Modificar
                    </button>
                  </div>
                </div>

                {/* Buscador dentro de asistentes */}
                {serviceAttendees.length > 5 && (
                  <div style={{ position: 'relative' }}>
                    <Search
                      size={15}
                      style={{
                        position: 'absolute',
                        left: '0.8rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Buscar en asistentes de este servicio..."
                      value={attendeeSearch}
                      onChange={(e) => setAttendeeSearch(e.target.value)}
                      style={{
                        width: '100%',
                        paddingLeft: '2.4rem',
                        paddingRight: '1rem',
                        paddingTop: '0.55rem',
                        paddingBottom: '0.55rem',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--border-radius)',
                        color: 'var(--text-primary)',
                        fontSize: '0.82rem',
                      }}
                    />
                  </div>
                )}

                {/* Listado de Asistentes */}
                {loadingAttendees ? (
                  <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={22} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                    <p style={{ margin: 0 }}>Cargando personas...</p>
                  </div>
                ) : filteredAttendees.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
                    {serviceAttendees.length === 0
                      ? 'No hay personas registradas para este servicio.'
                      : 'No se encontraron asistentes con ese criterio de búsqueda.'}
                  </p>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      maxHeight: '380px',
                      overflowY: 'auto',
                    }}
                  >
                    {filteredAttendees.map((item, index) => {
                      const member = item.member;
                      const isInactive = Boolean(member?.deleted_at) || member?.status === 'Inactivo';

                      return (
                        <div
                          key={item.attendance_id || item.member_id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            padding: '0.65rem 0.85rem',
                            background: 'var(--bg-secondary)',
                            borderRadius: 'var(--border-radius)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: 22 }}>
                              {index + 1}.
                            </span>
                            <div
                              className="avatar-placeholder"
                              style={{ width: 30, height: 30, fontSize: '0.75rem', flexShrink: 0 }}
                            >
                              {member?.full_name?.charAt(0).toUpperCase() || 'M'}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontWeight: 600,
                                  fontSize: '0.85rem',
                                  color: 'var(--text-primary)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {member?.full_name || 'Miembro no identificado'}
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                                <span
                                  className={`badge badge-${member?.status?.toLowerCase() || 'nuevo'}`}
                                  style={{ fontSize: '0.6rem', padding: '0.05rem 0.35rem' }}
                                >
                                  {member?.status || 'Registrado'}
                                </span>
                                {isInactive && (
                                  <span
                                    style={{
                                      fontSize: '0.6rem',
                                      padding: '0.05rem 0.35rem',
                                      borderRadius: '3px',
                                      background: 'rgba(239, 68, 68, 0.15)',
                                      color: '#ef4444',
                                      fontWeight: 600,
                                    }}
                                  >
                                    Inactivo
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {member?.phone && (
                            <a
                              href={getWhatsAppUrl(
                                member.phone,
                                `¡Hola ${member.full_name}! Dios te bendiga 🙏. Te saludo desde la Casa de Dios ${selectedCasa?.name} tras el servicio ${viewingService.name}.`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary"
                              style={{
                                padding: '0.35rem 0.6rem',
                                fontSize: '0.72rem',
                                gap: '0.3rem',
                                color: '#25D366',
                                borderColor: 'rgba(37, 211, 102, 0.3)',
                              }}
                            >
                              <MessageCircle size={13} />
                              {formatearTelefono(member.phone)}
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                  <button onClick={() => setViewingService(null)} className="btn btn-secondary">
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              MODAL: CONFIRMACIÓN PARA ELIMINAR SERVICIO
              ═══════════════════════════════════════════════════════════════ */}
          {serviceToDelete && (
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
              }}
              onClick={(e) => e.target === e.currentTarget && setServiceToDelete(null)}
            >
              <div
                className="card-glass"
                style={{
                  width: '100%',
                  maxWidth: '440px',
                  padding: '1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ef4444',
                    }}
                  >
                    <Trash2 size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                      ¿Eliminar este servicio?
                    </h3>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      Esta acción eliminará el servicio y su lista de asistencias.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    background: 'var(--bg-secondary)',
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--border-radius)',
                    fontSize: '0.85rem',
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {serviceToDelete.name}
                  </p>
                  <p style={{ margin: '0.2rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    📅 {formatearFechaServicio(serviceToDelete.date)}
                  </p>
                  <p style={{ margin: '0.2rem 0 0 0', color: 'var(--gold-primary)', fontSize: '0.8rem', fontWeight: 600 }}>
                    👥 {serviceToDelete.attendees_count} asistentes registrados
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setServiceToDelete(null)}
                    className="btn btn-secondary"
                    disabled={deletingService}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteService}
                    className="btn btn-danger"
                    disabled={deletingService}
                    style={{ gap: '0.4rem' }}
                  >
                    {deletingService ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        Eliminando...
                      </>
                    ) : (
                      <>
                        <Trash2 size={15} />
                        Confirmar y Eliminar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              MODAL: SCRIPT SQL PARA VINCULAR CASAS DE DIOS
              ═══════════════════════════════════════════════════════════════ */}
          {showSqlModal && (
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
              }}
              onClick={(e) => e.target === e.currentTarget && setShowSqlModal(false)}
            >
              <div
                className="card-glass"
                style={{
                  width: '100%',
                  maxWidth: '680px',
                  padding: '1.75rem',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <Sparkles size={20} color="var(--gold-primary)" />
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                      Script SQL: Vincular Asistencia a Casas de Dios
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowSqlModal(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Ejecuta este script en el <strong>SQL Editor</strong> de Supabase para agregar la columna <code>house_group_id</code> a la tabla de servicios:
                </p>

                <pre
                  style={{
                    background: '#0d1117',
                    color: '#58a6ff',
                    padding: '1rem',
                    borderRadius: 'var(--border-radius)',
                    fontSize: '0.78rem',
                    overflowX: 'auto',
                    border: '1px solid var(--border-subtle)',
                    maxHeight: '320px',
                    lineHeight: 1.5,
                  }}
                >
                  {sqlScript}
                </pre>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(sqlScript);
                      showToast('¡Script SQL copiado al portapapeles!');
                    }}
                    className="btn btn-primary"
                    style={{ gap: '0.5rem', fontSize: '0.85rem' }}
                  >
                    <Copy size={16} />
                    Copiar Script SQL
                  </button>

                  <button onClick={() => setShowSqlModal(false)} className="btn btn-secondary">
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
