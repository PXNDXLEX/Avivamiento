export const VERSICULOS = [
  {
    texto: 'Apacentad la grey de Dios que está entre vosotros, cuidando de ella, no por fuerza, sino voluntariamente; no por ganancia deshonesta, sino con ánimo pronto;',
    referencia: '1 Pedro 5:2 RVR1960',
  },
  {
    texto: '¿Qué hombre de vosotros, teniendo cien ovejas, si pierde una de ellas, no deja las noventa y nueve en el desierto, y va tras la que se perdió, hasta encontrarla?',
    referencia: 'San Lucas 15:4 RVR1960',
  },
  {
    texto: 'Yo soy el buen pastor; el buen pastor su vida da por las ovejas.',
    referencia: 'San Juan 10:11 RVR1960',
  },
  {
    texto: 'Cuando hubieron comido, Jesús dijo a Simón Pedro: Simón, hijo de Jonás, ¿me amas más que estos? Le respondió: Sí, Señor; tú sabes que te amo. Él le dijo: Apacienta mis corderos.',
    referencia: 'San Juan 21:15 RVR1960',
  },
  {
    texto: 'El amor sea sin fingimiento. Aborreced lo malo, seguid lo bueno.',
    referencia: 'Romanos 12:9 RVR1960',
  },
  {
    texto: 'Amaos los unos a los otros con amor fraternal; en cuanto a honra, prefiriéndoos los unos a los otros.',
    referencia: 'Romanos 12:10 RVR1960',
  },
];

export function getRandomVersiculo() {
  return VERSICULOS[Math.floor(Math.random() * VERSICULOS.length)];
}

export function normalizarCiudad(ciudad: string): string {
  return ciudad
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatearFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatearFechaCorta(fecha: string): string {
  const d = new Date(fecha.includes('T') ? fecha : `${fecha}T12:00:00Z`);
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
  });
}

/**
 * Prefijos móviles válidos en Venezuela según operadoras:
 * - Movistar: 0414, 0424
 * - Movilnet: 0416, 0426
 * - Digitel: 0412, 0422
 */
export const PREFIJOS_VENEZUELA = [
  '0414',
  '0424',
  '0416',
  '0426',
  '0412',
  '0422',
] as const;

export type PrefijoVenezuela = (typeof PREFIJOS_VENEZUELA)[number];

/**
 * Limpia la entrada para permitir únicamente números y normaliza
 * códigos como +58 o 58, limitando a un máximo de 11 dígitos.
 */
export function limpiarTelefonoInput(value: string): string {
  if (!value) return '';
  let digits = value.replace(/\D/g, '');

  if (digits.startsWith('580') && digits.length >= 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('58') && digits.length >= 11) {
    const localPart = digits.slice(2);
    digits = localPart.startsWith('0') ? localPart : '0' + localPart;
  } else if (digits.length === 10 && /^(414|424|416|426|412|422)/.test(digits)) {
    digits = '0' + digits;
  }

  return digits.slice(0, 11);
}

export interface ValidacionTelefono {
  isValid: boolean;
  cleanPhone: string;
  prefix: string;
  isPrefixValid: boolean;
  error?: string;
}

/**
 * Valida si un número telefónico cumple con el estándar móvil venezolano:
 * - Debe ser solo dígitos numéricos.
 * - Debe iniciar con un prefijo válido: 0414, 0424, 0416, 0426, 0412 o 0422.
 * - Debe tener exactamente 7 dígitos tras el prefijo (total 11 dígitos).
 */
export function validarTelefonoVenezolano(phone?: string | null): ValidacionTelefono {
  if (!phone || !phone.trim()) {
    return {
      isValid: true,
      cleanPhone: '',
      prefix: '',
      isPrefixValid: true,
    };
  }

  const trimmed = phone.trim();

  // Verificar si contiene letras u otros caracteres no permitidos
  if (/[^\d\s\-\+\(\)]/.test(trimmed)) {
    return {
      isValid: false,
      cleanPhone: trimmed.replace(/\D/g, ''),
      prefix: '',
      isPrefixValid: false,
      error: 'El teléfono debe contener únicamente números.',
    };
  }

  let digits = trimmed.replace(/\D/g, '');

  if (digits.startsWith('580') && digits.length >= 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('58') && digits.length >= 11) {
    const localPart = digits.slice(2);
    digits = localPart.startsWith('0') ? localPart : '0' + localPart;
  } else if (digits.length === 10 && /^(414|424|416|426|412|422)/.test(digits)) {
    digits = '0' + digits;
  }

  const prefix = digits.slice(0, 4);
  const isPrefixValid = (PREFIJOS_VENEZUELA as readonly string[]).includes(prefix as any);

  if (digits.length < 4) {
    return {
      isValid: false,
      cleanPhone: digits,
      prefix,
      isPrefixValid: false,
      error: 'Debe ingresar un prefijo venezolano válido (0414, 0424, 0416, 0426, 0412 o 0422).',
    };
  }

  if (!isPrefixValid) {
    return {
      isValid: false,
      cleanPhone: digits,
      prefix,
      isPrefixValid: false,
      error: `Prefijo "${prefix}" no válido. Debe comenzar con 0414, 0424, 0416, 0426, 0412 o 0422.`,
    };
  }

  if (digits.length < 11) {
    return {
      isValid: false,
      cleanPhone: digits,
      prefix,
      isPrefixValid: true,
      error: `Faltan dígitos. El número debe tener 11 dígitos (${prefix} seguido de 7 dígitos). Actualmente tiene ${digits.length}.`,
    };
  }

  if (digits.length > 11) {
    return {
      isValid: false,
      cleanPhone: digits,
      prefix,
      isPrefixValid: true,
      error: `El número excede los 11 dígitos requeridos (${prefix} seguido de 7 dígitos).`,
    };
  }

  return {
    isValid: true,
    cleanPhone: digits,
    prefix,
    isPrefixValid: true,
  };
}

export function formatearTelefono(phone?: string | null): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) return trimmed;

  // Caso: 5804141234567 -> 04141234567
  if (digits.startsWith('580') && digits.length >= 12) {
    return digits.slice(2);
  }

  // Caso: +584141234567 o 584141234567 -> 04141234567
  if (digits.startsWith('58') && digits.length >= 11) {
    const localPart = digits.slice(2);
    return localPart.startsWith('0') ? localPart : '0' + localPart;
  }

  // Caso: 4141234567 (10 dígitos sin el 0 inicial) -> 04141234567
  if (digits.length === 10 && /^(412|414|424|416|426|422|2\d{2})/.test(digits)) {
    return '0' + digits;
  }

  // Si ya tiene 11 dígitos y empieza por 0 (ej. 04148007840) -> 0414-8007840
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  return trimmed;
}

/**
 * Genera el enlace wa.me internacional garantizando el código de país +58 de Venezuela.
 * Convierte formatos como 0414..., 414..., +58414... a 58414... para que WhatsApp no dé error.
 */
export function getWhatsAppUrl(phone?: string | null, message?: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('580')) {
    digits = '58' + digits.slice(3);
  } else if (digits.startsWith('58') && digits.length >= 12) {
    // Ya tiene el código 58
  } else if (digits.startsWith('0')) {
    // 0414... -> 58414...
    digits = '58' + digits.slice(1);
  } else if (digits.length === 10 && /^(412|414|424|416|426|422)/.test(digits)) {
    // 414... -> 58414...
    digits = '58' + digits;
  } else if (!digits.startsWith('58')) {
    digits = '58' + digits;
  }

  const encodedMsg = message ? encodeURIComponent(message) : '';
  return `https://wa.me/${digits}${encodedMsg ? `?text=${encodedMsg}` : ''}`;
}

/**
 * Formatea una fecha para el histórico de seguimiento (e.g. "HOY - 12 de Octubre, 2026 (10:30 AM)")
 */
export function formatearFechaInteraccion(fechaStr: string): string {
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr;

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    const timeStr = d.toLocaleTimeString('es-VE', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const day = d.getDate();
    const month = d.toLocaleDateString('es-VE', { month: 'long' });
    const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
    const year = d.getFullYear();

    const dateFormatted = `${day} de ${capitalizedMonth}, ${year}`;

    if (isToday) {
      return `HOY - ${dateFormatted} (${timeStr})`;
    } else if (isYesterday) {
      return `AYER - ${dateFormatted} (${timeStr})`;
    } else {
      return `${dateFormatted} (${timeStr})`;
    }
  } catch {
    return fechaStr;
  }
}


