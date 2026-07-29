/**
 * Todo lo específico del archivo Excel manual "ASISTENCIAS_EN_LABS" que
 * Power Query consume — centralizado aquí a propósito (ver EXPORT-NOTES.md)
 * para que ningún otro módulo del sistema conozca estas manías de un archivo
 * externo. El catálogo `laboratorio` (BD) usa nombres normales, sin
 * mayúsculas forzadas ni NBSP — la conversión ocurre solo al exportar.
 */

/**
 * El Excel original termina los nombres de laboratorio en un espacio no
 * separable (U+00A0), no un espacio normal — así los identifica Power Query
 * como una sola categoría estable. Sin este carácter exacto, Power Query
 * vería "TELECOMUNICACIONES" (con NBSP) y "TELECOMUNICACIONES" (sin NBSP,
 * si algún día alguien lo escribe distinto) como dos categorías distintas.
 */
export const NBSP = ' ';

export interface AreaLaboratorio {
  /** Nombre de la hoja del libro. */
  hoja: string;
  /** Nombre exacto de la tabla de Excel (ListObject) — Power Query lee por
   * este nombre, no por rango de celdas. No siempre coincide con `hoja`. */
  tabla: string;
}

/** Las 14 hojas/tablas de laboratorio, en el orden exacto del libro. */
export const AREAS: readonly AreaLaboratorio[] = [
  { hoja: 'LAB ELECTRONICA', tabla: 'LAB_ELECTRONICA' },
  { hoja: 'LAB FISICA', tabla: 'LAB_FISICA' },
  { hoja: 'CAMARA DE GESELL', tabla: 'LAB_CAMARA_DE_GESELL' },
  { hoja: 'LAB MECANICA', tabla: 'LAB_MECANICA' },
  { hoja: 'LAB GEOTECNIA', tabla: 'LAB_GEOTECNIA' },
  {
    hoja: 'LAB MATERIALES Y ESTRUCTURAS',
    tabla: 'LAB_MATERIALES_Y_ESTRUCTURAS',
  },
  { hoja: 'PAVIMENTOS', tabla: 'LAB_PAVIMENTOS' },
  { hoja: 'LAB QUIMICA Y BIOLOGIA', tabla: 'LAB_QUIMICA_Y_BIOLOGIA' },
  { hoja: 'LAB DE INDUSTRIAL', tabla: 'LAB_DE_INDUSTRIAL' },
  { hoja: 'LABS CULTURA FISICA', tabla: 'LAB_DE_CULTURA_FISICA' },
  { hoja: 'LAB DE HIDRAULICA', tabla: 'LAB_DE_HIDRAULICA' },
  { hoja: 'LAB DE MICROBIOLOGIA', tabla: 'LAB_DE_MICROBIOLOGIA' },
  { hoja: 'LAB DE ANALISIS AMBIENTALES', tabla: 'LAB_DE_ANALISIS_AMBIENTALES' },
  { hoja: 'LAB DE ECOLOGIA', tabla: 'LAB_DE_ECOLOGIA' },
] as const;

/**
 * `laboratorio.nombre` (BD, ver src/laboratorios/seed/laboratorios.seed.ts)
 * → hoja a la que pertenece. Un laboratorio que no aparezca aquí (ej. los 11
 * labs "de área" del seed original, si siguen en la BD) NO se ubica a
 * ciegas: queda fuera del Excel y se reporta en la validación (ver
 * GAP-REPORT.md: "si el sistema tiene laboratorios que no encajan... no los
 * ubiques arbitrariamente").
 *
 * Varias asignaciones están marcadas [inferido]: el mensaje original no
 * especificó a qué hoja pertenecen (MOTORES, las 2 salas de semillero de
 * materiales, los módulos de investigación de pavimento/física/orgánica, y
 * FABRICACIÓN DIGITAL) — se ubicaron por afinidad temática con el nombre.
 * Ver EXPORT-NOTES.md para el detalle caso por caso.
 */
export const LABORATORIO_A_HOJA: Readonly<Record<string, string>> = {
  'Digitales y Programación': 'LAB ELECTRONICA',
  'Instrumentación Electrónica': 'LAB ELECTRONICA',
  'Automatización y Control': 'LAB ELECTRONICA',
  'Potencia y Energía': 'LAB ELECTRONICA',
  Telecomunicaciones: 'LAB ELECTRONICA',
  'Módulo de Investigación': 'LAB ELECTRONICA',
  'Inteligencia Artificial y Tecnocreatividad': 'LAB ELECTRONICA',
  'Fabricación Digital': 'LAB ELECTRONICA', // [inferido]

  'Física Mecánica y Eléctrica': 'LAB FISICA',
  'Física de Materiales y Termodinámica': 'LAB FISICA',
  'Módulo de Investigación en Física de Materiales': 'LAB FISICA', // [inferido]

  'Cámara de Gesell': 'CAMARA DE GESELL',

  Motores: 'LAB MECANICA', // [inferido]
  Térmicas: 'LAB MECANICA',
  'Procesos y Manufactura': 'LAB MECANICA',
  Materiales: 'LAB MECANICA',
  'Sala de Semillero 2 de Procesos de Manufactura': 'LAB MECANICA',

  Geotecnia: 'LAB GEOTECNIA',

  'Materiales y Estructuras': 'LAB MATERIALES Y ESTRUCTURAS',
  'Sala de Semillero 1 de Materiales': 'LAB MATERIALES Y ESTRUCTURAS', // [inferido]
  'Sala de Semillero 2 de Materiales': 'LAB MATERIALES Y ESTRUCTURAS', // [inferido]

  Pavimentos: 'PAVIMENTOS',
  'Módulo de Investigación en Pavimentos': 'PAVIMENTOS', // [inferido]

  'Química Orgánica': 'LAB QUIMICA Y BIOLOGIA',
  'Química Inorgánica': 'LAB QUIMICA Y BIOLOGIA',
  Biología: 'LAB QUIMICA Y BIOLOGIA',
  'Módulo de Investigación Orgánica': 'LAB QUIMICA Y BIOLOGIA', // [inferido]
  'Módulo de Investigación en Biología': 'LAB QUIMICA Y BIOLOGIA',

  'Métodos Industriales': 'LAB DE INDUSTRIAL',

  Morfofisiología: 'LABS CULTURA FISICA',
  'Fisiología del Ejercicio': 'LABS CULTURA FISICA',

  Hidráulica: 'LAB DE HIDRAULICA',
  Microbiología: 'LAB DE MICROBIOLOGIA',
  'Análisis y Estudios Ambientales': 'LAB DE ANALISIS AMBIENTALES',
  Ecología: 'LAB DE ECOLOGIA',
};

/** `laboratorio.nombre` (BD) → valor exacto que exige la columna J. */
export function nombreExcelLaboratorio(nombreBd: string): string {
  return `${nombreBd.toLocaleUpperCase('es')}${NBSP}`;
}

/**
 * `tipo_reserva.nombre` (BD) → valor de la lista cerrada "Uso de Laboratorio"
 * (columna N / lista auxiliar V). `Semillero` NO tiene equivalente en la
 * lista cerrada del Excel (confirmado: no está entre las 8 opciones) — se
 * exporta tal cual y queda marcado "fuera de lista" en el reporte de
 * validación en vez de forzarlo a otra categoría (ver GAP-REPORT.md §4).
 */
export const USO_LABORATORIO_MAP: Readonly<Record<string, string>> = {
  Docencia: 'Docencia',
  'Práctica libre': 'Prácticas Libres',
  'Investigación / Tesis': 'Investigación - Tesis',
  CAU: 'CAU',
  Marketing: 'Marketing',
  'Servicios Externos': 'Servicios Externos',
  'Clase Cancelada': 'Clase Cancelada',
  'Prácticas Libres Canceladas': 'Prácticas Libres Canceladas',
};

/** Lista cerrada completa (columna N / lista auxiliar V), en el orden del Excel. */
export const USO_LABORATORIO_LISTA_CERRADA: readonly string[] = [
  'Investigación - Tesis',
  'Docencia',
  'Prácticas Libres',
  'Prácticas Libres Canceladas',
  'CAU',
  'Marketing',
  'Servicios Externos',
  'Clase Cancelada',
];

/** Lista cerrada de "Observaciones" (columna O / lista auxiliar W). */
export const OBSERVACIONES_LISTA_CERRADA: readonly string[] = [
  'Ninguno',
  'Docente ausente',
  'Estudiantes ausentes',
  'Evento academico',
  'Circunstancia no prevista',
];

/** `registro_uso.novedad` (BD, texto libre) → valor de "Observaciones". */
export function observacionExcel(novedad: string | null | undefined): string {
  const limpio = (novedad ?? '').trim();
  return limpio.length > 0 ? limpio : 'Ninguno';
}

/** Lista cerrada "Nivel" (columna F / lista auxiliar U). */
export const NIVEL_LISTA_CERRADA: readonly string[] = ['Pregrado', 'Posgrado'];

/** Semanas académicas (lista auxiliar R). */
export const SEMANAS_LISTA: readonly (number | string)[] = [
  ...Array.from({ length: 18 }, (_, i) => i + 1),
  'Intersemestral',
];

/** Encabezados exactos de las columnas A–O, en orden (fila 1 de cada tabla). */
export const ENCABEZADOS_COLUMNAS: readonly string[] = [
  'Semana',
  'Fecha',
  'Hora Inicio',
  'Hora Final',
  'Tiempo de Uso',
  'Nivel',
  'Division',
  'Facultad',
  'Docente',
  'Laboratorio ', // con espacio final — exacto como en el archivo original
  'Número de Estudiantes',
  'Materia',
  'Laboratorista',
  'Uso de Laboratorio',
  'Observaciones',
];

/** Docente literal "Estudiantes": tipos de reserva a los que aplica la
 * convención del archivo original (ver GAP-REPORT.md §4, pregunta 2). */
export const TIPOS_DOCENTE_ES_ESTUDIANTES: readonly string[] = [
  'Investigación / Tesis',
  'Semillero',
];
