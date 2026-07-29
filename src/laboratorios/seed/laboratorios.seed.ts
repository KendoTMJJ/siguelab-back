import { DataSource } from 'typeorm';
import { Laboratorio } from '../entities/laboratorio.entity';

/**
 * Reemplaza el catálogo genérico anterior (11 labs "de área") por las 35
 * salas reales que exige el export de asistencias a Power BI (columna J del
 * Excel — ver GAP-REPORT.md / EXPORT-NOTES.md). Los nombres aquí van en
 * mayúscula/minúscula normal para el resto de la UI (formularios,
 * calendario, etc.); la conversión a MAYÚSCULAS + NBSP final que exige el
 * Excel vive solo en `src/reportes/constantes/asistencias-excel.constants.ts`,
 * para no ensuciar el resto de la app con ese detalle de un archivo externo.
 *
 * Capacidad: el Excel no trae aforo por sala — se deja un valor por defecto
 * razonable (20) y el admin lo ajusta luego vía el CRUD de laboratorios.
 */
const LABORATORIOS_BASE: Array<{ nombre: string; capacidad: number }> = [
  // Área: LAB ELECTRONICA
  { nombre: 'Digitales y Programación', capacidad: 20 },
  { nombre: 'Instrumentación Electrónica', capacidad: 20 },
  { nombre: 'Automatización y Control', capacidad: 20 },
  { nombre: 'Potencia y Energía', capacidad: 20 },
  { nombre: 'Telecomunicaciones', capacidad: 20 },
  { nombre: 'Módulo de Investigación', capacidad: 10 },
  { nombre: 'Inteligencia Artificial y Tecnocreatividad', capacidad: 20 },
  // Área: LAB FISICA
  { nombre: 'Física Mecánica y Eléctrica', capacidad: 20 },
  { nombre: 'Física de Materiales y Termodinámica', capacidad: 20 },
  { nombre: 'Módulo de Investigación en Física de Materiales', capacidad: 10 },
  // Área: CAMARA DE GESELL
  { nombre: 'Cámara de Gesell', capacidad: 10 },
  // Área: LAB MECANICA
  { nombre: 'Motores', capacidad: 20 },
  { nombre: 'Térmicas', capacidad: 20 },
  { nombre: 'Procesos y Manufactura', capacidad: 20 },
  { nombre: 'Materiales', capacidad: 20 },
  { nombre: 'Sala de Semillero 2 de Procesos de Manufactura', capacidad: 10 },
  // Área: LAB GEOTECNIA
  { nombre: 'Geotecnia', capacidad: 20 },
  // Área: LAB MATERIALES Y ESTRUCTURAS
  { nombre: 'Materiales y Estructuras', capacidad: 20 },
  { nombre: 'Sala de Semillero 1 de Materiales', capacidad: 10 },
  { nombre: 'Sala de Semillero 2 de Materiales', capacidad: 10 },
  // Área: PAVIMENTOS
  { nombre: 'Pavimentos', capacidad: 20 },
  { nombre: 'Módulo de Investigación en Pavimentos', capacidad: 10 },
  // Área: LAB QUIMICA Y BIOLOGIA
  { nombre: 'Química Orgánica', capacidad: 20 },
  { nombre: 'Química Inorgánica', capacidad: 20 },
  { nombre: 'Biología', capacidad: 20 },
  { nombre: 'Módulo de Investigación Orgánica', capacidad: 10 },
  { nombre: 'Módulo de Investigación en Biología', capacidad: 10 },
  // Área: LAB DE INDUSTRIAL
  { nombre: 'Métodos Industriales', capacidad: 20 },
  // Área: LABS CULTURA FISICA
  { nombre: 'Morfofisiología', capacidad: 20 },
  { nombre: 'Fisiología del Ejercicio', capacidad: 20 },
  // Área: LAB DE HIDRAULICA
  { nombre: 'Hidráulica', capacidad: 20 },
  // Área: LAB DE MICROBIOLOGIA
  { nombre: 'Microbiología', capacidad: 20 },
  // Área: LAB DE ANALISIS AMBIENTALES
  { nombre: 'Análisis y Estudios Ambientales', capacidad: 20 },
  // Área: LAB DE ECOLOGIA
  { nombre: 'Ecología', capacidad: 20 },
  // Sin área confirmada en el mensaje original (ver EXPORT-NOTES.md) —
  // asignada a LAB ELECTRONICA por afinidad temática, a confirmar.
  { nombre: 'Fabricación Digital', capacidad: 20 },
];

/**
 * No siembra asociaciones (espacio_laboratorio / docente_laboratorio):
 * las carga el admin gradualmente vía API.
 */
export async function seedLaboratorios(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Laboratorio);

  for (const dato of LABORATORIOS_BASE) {
    const existente = await repo.findOne({ where: { nombre: dato.nombre } });
    if (!existente) {
      await repo.save(repo.create(dato));
      console.log(`Laboratorio "${dato.nombre}" creado.`);
    }
  }
}
