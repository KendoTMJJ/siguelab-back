import { DataSource } from 'typeorm';
import { Division } from '../entities/division.entity';
import { Facultad } from '../entities/facultad.entity';
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
];

const DIVISIONES_BASE = [
  'Arquitectura e Ingenierías',
  'Ciencias de la Salud',
  'Ciencias Sociales y de la Educación',
  'Ciencias Económicas, Administrativas y Contables',
  'Ciencias Jurídicas y Políticas',
];

const FACULTADES_BASE: Array<{ division: string; nombre: string }> = [
  { division: 'Arquitectura e Ingenierías', nombre: 'Ingeniería Electrónica' },
  { division: 'Arquitectura e Ingenierías', nombre: 'Bioingeniería' },
  { division: 'Arquitectura e Ingenierías', nombre: 'Ingeniería Mecánica' },
  { division: 'Arquitectura e Ingenierías', nombre: 'Ingeniería Civil' },
  { division: 'Arquitectura e Ingenierías', nombre: 'Arquitectura' },
  { division: 'Arquitectura e Ingenierías', nombre: 'Diseño de Interacción' },
  {
    division: 'Arquitectura e Ingenierías',
    nombre: 'Ing. de Datos e Inteligencia Artificial',
  },
  { division: 'Ciencias de la Salud', nombre: 'Enfermería' },
  { division: 'Ciencias Jurídicas y Políticas', nombre: 'Derecho' },
  {
    division: 'Ciencias Sociales y de la Educación',
    nombre: 'Doctorado en Pedagogía',
  },
  {
    division: 'Ciencias Económicas, Administrativas y Contables',
    nombre: 'Contaduría Pública',
  },
  {
    division: 'Ciencias Económicas, Administrativas y Contables',
    nombre: 'Administración de Empresas',
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
