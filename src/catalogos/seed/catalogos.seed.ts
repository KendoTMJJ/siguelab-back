import { DataSource } from 'typeorm';
import { Division } from '../entities/division.entity';
import { Facultad, NivelFacultad } from '../entities/facultad.entity';
import { TipoReserva } from '../entities/tipo-reserva.entity';
import { PeriodoAcademico } from '../entities/periodo-academico.entity';

const TIPOS_RESERVA_BASE: Array<{
  nombre: string;
  esExclusiva: boolean;
  requiereEspacio: boolean;
}> = [
  { nombre: 'Docencia', esExclusiva: true, requiereEspacio: true },
  { nombre: 'Práctica libre', esExclusiva: false, requiereEspacio: false },
  {
    nombre: 'Investigación / Tesis',
    esExclusiva: false,
    requiereEspacio: false,
  },
  { nombre: 'Semillero', esExclusiva: false, requiereEspacio: false },
  { nombre: 'CAU', esExclusiva: false, requiereEspacio: false },
  // Agregados para que el catálogo cubra las opciones cerradas de
  // "Uso de Laboratorio" del export de asistencias (ver GAP-REPORT.md §4).
  { nombre: 'Marketing', esExclusiva: false, requiereEspacio: false },
  {
    nombre: 'Servicios Externos',
    esExclusiva: false,
    requiereEspacio: false,
  },
  // "Clase Cancelada" y "Prácticas Libres Canceladas" NO van aquí: son
  // estados que toma una reserva cuando se cancela, no tipos de reserva
  // seleccionables.
];

const DIVISIONES_BASE = [
  'Arquitectura e Ingenierías',
  'Ciencias de la Salud',
  'Ciencias Sociales y de la Educación',
  'Ciencias Económicas, Administrativas y Contables',
  'Ciencias Jurídicas y Políticas',
];

/**
 * Tomado literalmente de la tabla División/Facultad/Nivel del documento de
 * referencia (screenshots del usuario). Ciencias de la Salud queda
 * incompleta a propósito: las dos capturas recibidas cortan esa división
 * justo en el borde inferior de la tabla — falta el resto de sus programas
 * de pregrado y posgrado, pendiente de que el usuario mande esas filas.
 */
const FACULTADES_BASE: Array<{
  division: string;
  nombre: string;
  nivel: NivelFacultad;
}> = [
  // ---- Pregrado ----
  {
    division: 'Ciencias Sociales y de la Educación',
    nombre: 'Diseño de Interacción',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Ciencias Sociales y de la Educación',
    nombre: 'Licenciatura en Español y Lenguas Extranjeras Inglés y Francés',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Ciencias Sociales y de la Educación',
    nombre: 'Licenciatura en Educación Infantil Bilingüe',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Ciencias Económicas, Administrativas y Contables',
    nombre: 'Marketing y Transformación Digital',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Ciencias Económicas, Administrativas y Contables',
    nombre: 'Administración de Empresas',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Ciencias Económicas, Administrativas y Contables',
    nombre: 'Negocios Internacionales',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Ciencias Económicas, Administrativas y Contables',
    nombre: 'Contaduría Pública',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Ciencias Jurídicas y Políticas',
    nombre: 'Derecho',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Ingeniería de Datos e Inteligencia Artificial',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Bioingeniería',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Arquitectura',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Ingeniería Ambiental',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Ingeniería Civil',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Ingeniería de Sistemas',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Ingeniería Electrónica',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Ingeniería Mecánica',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Ingeniería Industrial',
    nivel: NivelFacultad.PREGRADO,
  },
  {
    division: 'Ciencias de la Salud',
    nombre: 'Cultura Física, Deporte y Recreación',
    nivel: NivelFacultad.PREGRADO,
  },

  // ---- Posgrado ----
  {
    division: 'Ciencias Sociales y de la Educación',
    nombre: 'Doctorado en Pedagogía y Neurociencia Aplicada a la Educación',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias Económicas, Administrativas y Contables',
    nombre: 'Maestría en Marketing Internacional y Negocios',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias Económicas, Administrativas y Contables',
    nombre: 'Especialización en Auditoría de Salud',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias Económicas, Administrativas y Contables',
    nombre: 'Especialización en Auditoría y Aseguramiento de la Información',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias Económicas, Administrativas y Contables',
    nombre: 'Especialización en Gobierno y Gestión Territorial',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias Económicas, Administrativas y Contables',
    nombre: 'Especialización en Innovación y Marketing',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias Económicas, Administrativas y Contables',
    nombre: 'Maestría en Administración',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias Jurídicas y Políticas',
    nombre: 'Maestría en Derecho Minero-Ambiental',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias Jurídicas y Políticas',
    nombre: 'Especialización en Derecho Penal y Procesal Penal',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias Jurídicas y Políticas',
    nombre: 'Especialización en Derecho Administrativo',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias Jurídicas y Políticas',
    nombre: 'Especialización en Contratación Estatal',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias Jurídicas y Políticas',
    nombre: 'Especialización en Psicología Jurídica y Forense',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias Jurídicas y Políticas',
    nombre: 'Maestría en Derecho Administrativo',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias Jurídicas y Políticas',
    nombre: 'Maestría en Derecho Penal y Procesal Penal',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias Jurídicas y Políticas',
    nombre: 'Maestría en Derecho Privado',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias Jurídicas y Políticas',
    nombre: 'Doctorado en Derecho Público',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias Jurídicas y Políticas',
    nombre:
      'Estancia Posdoctoral en Ciencias Jurídicas, Innovación y Sociedad Global',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Maestría en Arquitectura Avanzada',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Maestría en Geotecnia Vial y Pavimentos',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Especialización en Ingeniería Hidroambiental',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Especialización en Gerencia de Mantenimiento y Gestión de Activos',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre:
      'Especialización en Gestión de Nuevas Tecnologías de Telecomunicaciones',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Especialización en Dirección y Gestión de la Calidad',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Especialización en Gerencia de Proyectos de Construcción',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Especialización en Geotecnia Vial y Pavimentos',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Especialización en Estructuras',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Especialización en Ingeniería Civil con Énfasis en Hidroambiental',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Maestría en Ingeniería',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Maestría en Manejo y Sostenibilidad Ambiental',
    nivel: NivelFacultad.POSGRADO,
  },
  {
    division: 'Ciencias de la Salud',
    nombre: 'Maestría en Entrenamiento Deportivo y Actividad Física',
    nivel: NivelFacultad.POSGRADO,
  },
];

const PERIODOS_BASE: Array<{
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  numSemanas: number;
}> = [
  {
    nombre: '2026-2',
    fechaInicio: '2026-07-20',
    fechaFin: '2026-11-20',
    numSemanas: 16,
  },
];

async function seedTiposReserva(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(TipoReserva);

  for (const dato of TIPOS_RESERVA_BASE) {
    const existente = await repo.findOne({ where: { nombre: dato.nombre } });
    if (!existente) {
      await repo.save(repo.create(dato));
      console.log(`Tipo de reserva "${dato.nombre}" creado.`);
    }
  }
}

async function seedDivisiones(
  dataSource: DataSource,
): Promise<Record<string, Division>> {
  const repo = dataSource.getRepository(Division);
  const divisiones: Record<string, Division> = {};

  for (const nombre of DIVISIONES_BASE) {
    let division = await repo.findOne({ where: { nombre } });
    if (!division) {
      division = await repo.save(repo.create({ nombre }));
      console.log(`División "${nombre}" creada.`);
    }
    divisiones[nombre] = division;
  }

  return divisiones;
}

async function seedFacultades(
  dataSource: DataSource,
  divisiones: Record<string, Division>,
): Promise<void> {
  const repo = dataSource.getRepository(Facultad);

  for (const dato of FACULTADES_BASE) {
    const existente = await repo.findOne({ where: { nombre: dato.nombre } });
    if (!existente) {
      await repo.save(
        repo.create({
          nombre: dato.nombre,
          idDivision: divisiones[dato.division].idDivision,
          nivel: dato.nivel,
        }),
      );
      console.log(`Facultad "${dato.nombre}" creada.`);
    }
  }
}

async function seedPeriodosAcademicos(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(PeriodoAcademico);

  for (const dato of PERIODOS_BASE) {
    const existente = await repo.findOne({ where: { nombre: dato.nombre } });
    if (!existente) {
      await repo.save(repo.create(dato));
      console.log(`Periodo académico "${dato.nombre}" creado.`);
    }
  }
}

export async function seedCatalogos(dataSource: DataSource): Promise<void> {
  await seedTiposReserva(dataSource);
  const divisiones = await seedDivisiones(dataSource);
  await seedFacultades(dataSource, divisiones);
  await seedPeriodosAcademicos(dataSource);
}
