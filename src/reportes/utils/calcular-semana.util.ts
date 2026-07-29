/**
 * Semana académica (columna A) a partir del período. Supuesto documentado en
 * GAP-REPORT.md §3: semanas corridas de 7 días desde `fechaInicio`, SIN
 * excluir festivos/semana de receso (el sistema no modela un calendario
 * académico con excepciones, solo el rango simple de `periodo_academico`).
 * Fuera del rango del período (antes de que empiece o después de que
 * termine) → "Intersemestral".
 */
export function calcularSemana(
  fecha: string,
  periodo: { fechaInicio: string; fechaFin: string; numSemanas: number },
): number | 'Intersemestral' {
  if (fecha < periodo.fechaInicio || fecha > periodo.fechaFin) {
    return 'Intersemestral';
  }
  const dias = diferenciaEnDias(periodo.fechaInicio, fecha);
  const semana = Math.floor(dias / 7) + 1;
  return semana > periodo.numSemanas ? 'Intersemestral' : semana;
}

function diferenciaEnDias(desde: string, hasta: string): number {
  const msPorDia = 24 * 60 * 60 * 1000;
  const fechaDesde = new Date(`${desde}T00:00:00Z`).getTime();
  const fechaHasta = new Date(`${hasta}T00:00:00Z`).getTime();
  return Math.round((fechaHasta - fechaDesde) / msPorDia);
}
