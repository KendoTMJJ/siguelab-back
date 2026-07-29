export interface FilaAsistencia {
  semana: number | string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  tiempoDeUso: number;
  nivel: string;
  division: string;
  facultad: string;
  docente: string;
  laboratorioExcel: string;
  numEstudiantes: number;
  materia: string;
  laboratorista: string;
  usoLaboratorio: string;
  observaciones: string;
}

export type TipoProblemaValidacion =
  | 'laboratorio_sin_hoja'
  | 'sin_solicitud_asociada'
  | 'uso_fuera_de_lista'
  | 'observacion_fuera_de_lista'
  | 'campo_obligatorio_vacio';

export interface ProblemaValidacion {
  idRegistro: number;
  tipo: TipoProblemaValidacion;
  detalle: string;
}

export interface ReporteAsistencias {
  periodoNombre: string;
  fechaDesde: string;
  fechaHasta: string;
  totalRegistros: number;
  /** Filas agrupadas por nombre de hoja (ver AREAS). Vacío si ningún
   * registro cayó en esa hoja — la tabla igual se crea, sin filas. */
  filasPorHoja: Map<string, FilaAsistencia[]>;
  problemas: ProblemaValidacion[];
}
