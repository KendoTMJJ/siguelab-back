import { DiaSemana } from 'src/horarios-academicos/entities/horario-academico.entity';

const DIAS_SEMANA_POR_INDICE: DiaSemana[] = [
  DiaSemana.DOMINGO,
  DiaSemana.LUNES,
  DiaSemana.MARTES,
  DiaSemana.MIERCOLES,
  DiaSemana.JUEVES,
  DiaSemana.VIERNES,
  DiaSemana.SABADO,
];

export function diaSemanaDeFecha(fechaISO: string): DiaSemana {
  const indice = new Date(`${fechaISO}T00:00:00Z`).getUTCDay();
  return DIAS_SEMANA_POR_INDICE[indice];
}

/**
 * "Hoy" en Bogotá (UTC-5, sin horario de verano), como medianoche UTC de
 * ESE día calendario — el servidor corre en contenedores con reloj UTC
 * (confirmado: `date` dentro del contenedor marca UTC), así que un
 * `new Date()` liso da el día calendario en UTC, no en Colombia. Entre las
 * 7pm y la medianoche hora Bogotá, el día UTC ya cambió al siguiente —
 * cualquier validación de "hoy"/antelación mínima que use eso corre un día
 * hacia adelante y rechaza fechas que el frontend (hora local del
 * navegador) sí muestra como válidas. Devuelve un Date en punto (medianoche
 * UTC del día de Bogotá) para poder seguir comparando contra
 * `new Date('YYYY-MM-DDT00:00:00Z')` sin mezclar convenciones.
 */
export function hoyBogota(): Date {
  const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;
  const ahoraBogota = new Date(Date.now() - OFFSET_BOGOTA_MS);
  return new Date(
    Date.UTC(
      ahoraBogota.getUTCFullYear(),
      ahoraBogota.getUTCMonth(),
      ahoraBogota.getUTCDate(),
    ),
  );
}

/** Mismo "hoy" de Bogotá, como string 'YYYY-MM-DD' — para comparar contra
 * columnas DATE (fecha_inicio/fecha_fin de periodo académico, etc.) sin
 * pasar por un objeto Date. */
export function hoyBogotaISO(): string {
  return hoyBogota().toISOString().slice(0, 10);
}

/**
 * Las horas de columnas TIME de la BD llegan como "HH:mm:ss", las de los
 * DTOs como "HH:mm" — comparar strings de distinta longitud produce falsos
 * cruces (ej. "09:00" < "09:00:00" es true por ser prefijo). Se normalizan
 * ambas a "HH:mm:ss" antes de comparar. Extraído de
 * SolicitudesService.horasCruzan para no repetir el mismo bug ya corregido
 * ahí en un tercer lugar (equipos-laboratorio, eventos-laboratorio).
 */
function normalizarHora(hora: string): string {
  return hora.length === 5 ? `${hora}:00` : hora;
}

export function horasCruzan(
  inicioA: string,
  finA: string,
  inicioB: string,
  finB: string,
): boolean {
  const iA = normalizarHora(inicioA);
  const fA = normalizarHora(finA);
  const iB = normalizarHora(inicioB);
  const fB = normalizarHora(finB);
  return iA < fB && fA > iB;
}
