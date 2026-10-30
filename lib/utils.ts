export const VERSICULOS = [
  { texto: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.', referencia: 'Juan 3:16' },
  { texto: 'Todo lo puedo en Cristo que me fortalece.', referencia: 'Filipenses 4:13' },
  { texto: 'El Señor es mi pastor; nada me faltará.', referencia: 'Salmos 23:1' },
  { texto: 'Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia.', referencia: 'Proverbios 3:5' },
  { texto: 'Mas buscad primeramente el reino de Dios y su justicia, y todas estas cosas os serán añadidas.', referencia: 'Mateo 6:33' },
  { texto: 'El Señor peleará por vosotros, y vosotros estaréis tranquilos.', referencia: 'Éxodo 14:14' },
  { texto: 'Jehová es mi luz y mi salvación; ¿de quién temeré?', referencia: 'Salmos 27:1' },
  { texto: 'Y conoceréis la verdad, y la verdad os hará libres.', referencia: 'Juan 8:32' },
  { texto: 'Porque yo sé los pensamientos que tengo acerca de vosotros, dice Jehová, pensamientos de paz, y no de mal, para daros el fin que esperáis.', referencia: 'Jeremías 29:11' },
  { texto: 'El que habita al abrigo del Altísimo morará bajo la sombra del Omnipotente.', referencia: 'Salmos 91:1' },
  { texto: 'No temas, porque yo estoy contigo; no desmayes, porque yo soy tu Dios que te esfuerzo.', referencia: 'Isaías 41:10' },
  { texto: 'Venid a mí todos los que estáis trabajados y cargados, y yo os haré descansar.', referencia: 'Mateo 11:28' },
  { texto: 'Bendito el varón que confía en Jehová, y cuya confianza es Jehová.', referencia: 'Jeremías 17:7' },
  { texto: 'Todo lo que pidiereis en oración, creyendo, lo recibiréis.', referencia: 'Mateo 21:22' },
  { texto: 'Porque con Dios nada será imposible.', referencia: 'Lucas 1:37' },
  { texto: 'El Señor está cerca de los quebrantados de corazón; y salva a los contritos de espíritu.', referencia: 'Salmos 34:18' },
  { texto: 'Todas las cosas ayudan a bien a los que aman a Dios.', referencia: 'Romanos 8:28' },
  { texto: 'Sean fuertes y valientes. No teman ni se asusten porque Jehová su Dios va con ellos; nunca los dejará ni los abandonará.', referencia: 'Deuteronomio 31:6' },
  { texto: 'El que comenzó en vosotros la buena obra, la perfeccionará hasta el día de Jesucristo.', referencia: 'Filipenses 1:6' },
  { texto: 'Así que la fe es por el oír, y el oír, por la palabra de Dios.', referencia: 'Romanos 10:17' },
  { texto: 'Someteos, pues, a Dios; resistid al diablo, y huirá de vosotros.', referencia: 'Santiago 4:7' },
  { texto: 'Porque Dios no nos ha dado un espíritu de cobardía, sino de poder, de amor y de dominio propio.', referencia: '2 Timoteo 1:7' },
  { texto: 'Yo soy la vid, vosotros los pámpanos; el que permanece en mí, y yo en él, éste lleva mucho fruto.', referencia: 'Juan 15:5' },
  { texto: 'Clama a mí, y yo te responderé, y te enseñaré cosas grandes y ocultas que tú no conoces.', referencia: 'Jeremías 33:3' },
  { texto: 'Regocijaos en el Señor siempre. Otra vez digo: ¡Regocijaos!', referencia: 'Filipenses 4:4' },
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


