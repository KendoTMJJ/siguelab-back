import { DataSource } from 'typeorm';
import { Laboratorio } from '../entities/laboratorio.entity';
import { EspacioAcademico } from 'src/catalogos/entities/espacio-academico.entity';
import { EspacioLaboratorio } from '../entities/espacio-laboratorio.entity';

/**
 * Igual que LABORATORIOS_BASE en laboratorios.seed.ts: contenido real (no
 * demo), así que corre solo en cada arranque (ver ConectionModule), no a
 * mano. Nombre del laboratorio (debe coincidir EXACTO con
 * LABORATORIOS_BASE) -> espacios académicos que dicta ahí. Un mismo espacio
 * puede repetirse bajo varios laboratorios (ej. "Programación") — se
 * resuelve más abajo asociándolo a cada uno sin duplicar la fila de
 * EspacioAcademico.
 */
const LABORATORIO_ESPACIOS: Record<string, string[]> = {
  'Análisis y Estudios Ambientales': [
    'Química Ambiental',
    'Tratamiento de Aguas',
    'Tratamiento de Aguas Residuales',
  ],
  'Automatización y Control': [
    'Automatización Industrial',
    'Circuitos Eléctricos C',
    'Control Analógico',
    'Control Digital',
    'Electrónica B',
    'Instrumentación Industrial',
    'Instrumentación y Automatización',
    'Lógica de Programación',
    'Programación',
    'Robótica Industrial',
  ],
  Biología: [
    'Biología Celular Molecular',
    'Biología General',
    'Climatología',
    'Fundamentos de Biología',
  ],
  'Digitales y Programación': [
    'Circuitos 2',
    'Electrónica C',
    'Electrónica 2',
    'Fundamentos de Circuitos',
    'Introducción a la Ingeniería',
    'Licitaciones y Contratos',
    'Lógica de Programación',
    'Procesamiento de la Información Biológica',
    'Señales y Sistemas A',
    'Señales y Sistemas B',
    'Sistemas Digitales 2',
  ],
  Ecología: [
    'Ecología',
    'Gestión Ambiental de Procesos',
    'Ordenamiento Territorial',
    'Potabilización',
  ],
  'Fisiología del Ejercicio': [
    'Asesorías de Proyectos de Investigación',
    'Biomecánica',
    'Evaluación Funcional',
    'Fisiología del Ejercicio',
    'Masaje Terapéutico y Deportivo',
    'Programación del Ejercicio',
    'Psicomotricidad',
    'Semillero de Investigación en Entrenamiento Deportivo',
  ],
  'Física de Materiales y Termodinámica': [
    'Electricidad y Magnetismo',
    'Procesos Térmicos de la Industria',
  ],
  'Física Mecánica y Eléctrica': ['Física Mecánica'],
  Hidráulica: ['Hidrología', 'Mecánica de Fluidos', 'Tuberías y Canales'],
  'Instrumentación Electrónica': [
    'Circuitos 1',
    'Circuitos Eléctricos A',
    'Circuitos Eléctricos B',
    'Circuitos Eléctricos C',
    'Electrónica 1',
    'Electrónica B',
    'Electrónica C',
    'Equipos e Instrumentación Biológica',
    'Introducción a la Ingeniería',
    'Procesamiento Digital de Señales',
    'Señales y Sistemas',
    'Sistemas Digitales',
    'Sistemas Digitales 1',
  ],
  'Inteligencia Artificial y Tecnocreatividad': [
    'Amazon Web Services',
    'Audiovisual Lab A',
    'Audiovisual Lab B',
    'Cultura Visual',
    'Dimensiones del Diseño de Interacción',
    'Diseño de Sonido',
    'Diseño y Visualización',
    'Expresión 3',
    'Identificación y Modelado de Sistemas',
    'Lógica Computacional',
    'Lúdica y los Videojuegos',
    'Metodologías y Métodos de Investigación',
    'Modelado de Personajes y Escenarios para Videojuegos',
    'Opción de Grado 2',
    'Programación',
    'Programación IxD 2',
    'Programación IxD 4',
    'Proyecto de Interacción 2',
    'Realidades',
  ],
  Materiales: [
    'Ciencia de Materiales',
    'Ingeniería de Materiales',
    'Materiales para Ingeniería',
    'Metrología',
    'Procesos de Manufactura 1',
    'Termodinámica',
  ],
  Microbiología: ['Microbiología y Biología de Sistemas'],
  Morfofisiología: [
    'Biomecánica',
    'Deporte Adaptado',
    'Deportes Arte y Precisión',
    'Entrenamiento Deportivo',
    'Fisiología de Sistemas',
    'Fundamentos de Morfofisiología',
    'Práctica: Anatomía Humana',
  ],
  'Métodos Industriales': [
    'Diseño y Análisis de Experimentos',
    'Ingeniería de Procesos',
    'Ingeniería de Métodos y Tiempos',
    'Innovación y Diseño',
    'Introducción a la Ingeniería',
  ],
  Pavimentos: [
    'Fundamentos de Geotecnia',
    'Mecánica de Suelos',
    'Pavimentos',
    'Procesos Constructivos',
    'Vías',
  ],
  'Potencia y Energía': [
    'Conversión Electromagnética',
    'Electrónica 3',
    'Electrónica de Potencia',
    'Machine Vision',
    'Ondas y Electromagnetismo',
    'Opción de Grado',
    'Proyecto de Investigación o Desarrollo 1',
  ],
  'Procesos y Manufactura': [
    'Introducción a la Ingeniería',
    'Introducción a la Ingeniería Mecánica',
    'Taller de Fabricación',
    'Taller de Fabricación / Bioingeniería',
    'Trabajo de Grado',
    'Procesos de Manufactura I',
    'Procesos de Mecanizado y Unión',
    'Gestión del Mantenimiento',
  ],
  'Química Inorgánica': ['Química General'],
  'Química Orgánica': ['Química General'],
  Telecomunicaciones: [
    'Administración de Proyectos',
    'Comunicaciones Inalámbricas',
    'Gestión de Proyectos',
    'Redes e Infraestructura',
    'Semiconductores',
    'Teoría de la Comunicación',
    'Transmisión de Datos',
  ],
  Térmicas: [
    'Transferencia de Calor',
    'Proyecto Integrador',
    'Diseño de Transmisión de Potencia',
    'Instalación de Máquinas Eléctricas',
    'Mantenimiento Eléctrico Industrial',
  ],
};

async function seedEspaciosAcademicos(
  dataSource: DataSource,
): Promise<Map<string, EspacioAcademico>> {
  const repo = dataSource.getRepository(EspacioAcademico);
  const nombresUnicos = [
    ...new Set(Object.values(LABORATORIO_ESPACIOS).flat()),
  ];
  const porNombre = new Map<string, EspacioAcademico>();

  for (const nombre of nombresUnicos) {
    let espacio = await repo.findOne({ where: { nombre } });
    if (!espacio) {
      espacio = await repo.save(repo.create({ nombre }));
      console.log(`Espacio académico "${nombre}" creado.`);
    }
    porNombre.set(nombre, espacio);
  }

  return porNombre;
}

async function asociarConLaboratorios(
  dataSource: DataSource,
  espaciosPorNombre: Map<string, EspacioAcademico>,
): Promise<void> {
  const laboratorioRepo = dataSource.getRepository(Laboratorio);
  const espacioLabRepo = dataSource.getRepository(EspacioLaboratorio);

  for (const [nombreLab, espacios] of Object.entries(LABORATORIO_ESPACIOS)) {
    const laboratorio = await laboratorioRepo.findOne({
      where: { nombre: nombreLab },
    });
    if (!laboratorio) {
      // No debería pasar si laboratorios.seed.ts ya corrió antes que este
      // (ver orden en ConectionModule) — se avisa en vez de reventar el
      // arranque completo por un nombre desalineado.
      console.warn(
        `[espacios-laboratorios.seed] Laboratorio "${nombreLab}" no existe, se omite.`,
      );
      continue;
    }

    for (const nombreEspacio of espacios) {
      const espacio = espaciosPorNombre.get(nombreEspacio)!;
      const yaAsociado = await espacioLabRepo.exists({
        where: {
          idEspacio: espacio.idEspacio,
          idLaboratorio: laboratorio.idLaboratorio,
        },
      });
      if (!yaAsociado) {
        await espacioLabRepo.save(
          espacioLabRepo.create({
            idEspacio: espacio.idEspacio,
            idLaboratorio: laboratorio.idLaboratorio,
          }),
        );
      }
    }
  }
}

/** Idempotente, igual que el resto de los seeds de contenido real (roles,
 * catálogos, laboratorios): correr esto en cada arranque nunca duplica
 * espacios ni asociaciones ya existentes. */
export async function seedEspaciosLaboratorios(
  dataSource: DataSource,
): Promise<void> {
  const espaciosPorNombre = await seedEspaciosAcademicos(dataSource);
  await asociarConLaboratorios(dataSource, espaciosPorNombre);
}
