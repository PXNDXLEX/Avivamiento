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
  try {
    const d = new Date(fecha.includes('T') ? fecha : `${fecha}T12:00:00Z`);
    if (isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString('es-VE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return fecha;
  }
}

export function obtenerFechaActualInput(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatearParaInputDate(fecha?: string | null): string {
  if (!fecha) return obtenerFechaActualInput();
  try {
    const d = new Date(fecha.includes('T') ? fecha : `${fecha}T12:00:00Z`);
    if (isNaN(d.getTime())) return obtenerFechaActualInput();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return obtenerFechaActualInput();
  }
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

/**
 * Limpia la entrada para números internacionales:
 * Asegura el signo '+' al inicio y permite hasta 15 dígitos numéricos (estándar E.164).
 */
export function limpiarTelefonoInternacionalInput(value: string): string {
  if (!value) return '+';
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '+';
  return `+${digits.slice(0, 15)}`;
}

/**
 * Detecta si una cadena de teléfono corresponde a un número internacional.
 */
export function isTelefonoInternacional(phone?: string | null): boolean {
  if (!phone) return false;
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return true;
  return false;
}

/**
 * Valida un número internacional según el estándar E.164 (código de país + número, entre 7 y 15 dígitos).
 */
export function validarTelefonoInternacional(phone?: string | null): ValidacionTelefono {
  if (!phone || !phone.trim() || phone.trim() === '+') {
    return {
      isValid: true,
      cleanPhone: '',
      prefix: '',
      isPrefixValid: true,
    };
  }

  const trimmed = phone.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (!digitsOnly) {
    return {
      isValid: true,
      cleanPhone: '',
      prefix: '',
      isPrefixValid: true,
    };
  }

  if (digitsOnly.length < 7) {
    return {
      isValid: false,
      cleanPhone: `+${digitsOnly}`,
      prefix: `+${digitsOnly.slice(0, 3)}`,
      isPrefixValid: false,
      error: `Faltan dígitos. Los números internacionales deben incluir su código de país y tener entre 7 y 15 dígitos (actualmente tiene ${digitsOnly.length}).`,
    };
  }

  if (digitsOnly.length > 15) {
    return {
      isValid: false,
      cleanPhone: `+${digitsOnly.slice(0, 15)}`,
      prefix: `+${digitsOnly.slice(0, 3)}`,
      isPrefixValid: false,
      error: 'El número internacional no debe exceder los 15 dígitos.',
    };
  }

  return {
    isValid: true,
    cleanPhone: `+${digitsOnly}`,
    prefix: `+${digitsOnly.slice(0, 3)}`,
    isPrefixValid: true,
  };
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
  const digitsOnly = trimmed.replace(/\D/g, '');

  // Si el campo está vacío o no contiene ningún dígito numérico, se considera en blanco (opcional y válido)
  if (!digitsOnly) {
    return {
      isValid: true,
      cleanPhone: '',
      prefix: '',
      isPrefixValid: true,
    };
  }

  // Verificar si contiene letras u otros caracteres no permitidos
  if (/[^\d\s\-\+\(\)]/.test(trimmed)) {
    return {
      isValid: false,
      cleanPhone: digitsOnly,
      prefix: '',
      isPrefixValid: false,
      error: 'El teléfono debe contener únicamente números.',
    };
  }

  let digits = digitsOnly;

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

  // Caso internacional: empieza con '+'
  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return '';

    // Si es venezolano en formato internacional +58:
    if (digits.startsWith('58') && (digits.length === 12 || digits.length === 13)) {
      let local = digits.slice(2);
      if (local.startsWith('0')) local = local.slice(1);
      return `+58 ${local.slice(0, 3)}-${local.slice(3)}`;
    }
    // +1 (USA / Canadá): +1 (XXX) XXX-XXXX
    if (digits.startsWith('1') && digits.length === 11) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    // +57 (Colombia): +57 XXX XXX XXXX
    if (digits.startsWith('57') && digits.length === 12) {
      return `+57 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
    }
    // +34 (España): +34 XXX XX XX XX
    if (digits.startsWith('34') && digits.length === 11) {
      return `+34 ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
    }
    // +56 (Chile): +56 9 XXXX XXXX
    if (digits.startsWith('56') && digits.length === 11) {
      return `+56 ${digits.slice(2, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
    }
    // Otros países: +CÓDIGO NÚMERO
    return `+${digits}`;
  }

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
 * Genera el enlace wa.me garantizando el código de país.
 * Para números nacionales venezolanos (0414, 0424, etc.) antepone el código 58.
 * Para números internacionales que inician con '+' preserva su código de país correspondiente.
 */
export function getWhatsAppUrl(phone?: string | null, message?: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';

  // Si es un número internacional (inicia con +), ya incluye su código de país
  if (trimmed.startsWith('+')) {
    if (digits.startsWith('580')) {
      digits = '58' + digits.slice(3);
    }
    // Usar directamente los dígitos con su código de país
  } else if (digits.startsWith('580')) {
    digits = '58' + digits.slice(3);
  } else if (digits.startsWith('58') && digits.length >= 12) {
    // Ya tiene el código 58
  } else if (digits.startsWith('0')) {
    // 0414... -> 58414...
    digits = '58' + digits.slice(1);
  } else if (digits.length === 10 && /^(412|414|424|416|426|422)/.test(digits)) {
    // 414... -> 58414...
    digits = '58' + digits;
  } else if (digits.length <= 11) {
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



export function formatearFechaServicio(fechaStr: string): string {
  try {
    if (!fechaStr) return '';
    const d = new Date(fechaStr.includes('T') ? fechaStr : `${fechaStr}T12:00:00Z`);
    const diaSemana = d.toLocaleDateString('es-VE', { weekday: 'long' });
    const diaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
    const day = d.getDate();
    const month = d.toLocaleDateString('es-VE', { month: 'long' });
    const mesCapitalizado = month.charAt(0).toUpperCase() + month.slice(1);
    const year = d.getFullYear();
    return `${diaCapitalizado}, ${day} de ${mesCapitalizado} de ${year}`;
  } catch {
    return fechaStr;
  }
}
