/**
 * Datos de ejemplo para VISUALIZAR el sistema funcionando (calendario,
 * bandeja de aprobaciones, historial de solicitudes, bitácora,
 * estadísticas) — a diferencia de seedAdmin/seedUsuariosDemo/seedCatalogos/
 * seedLaboratorios (esos sí corren solos en cada arranque, ver
 * ConectionModule), este archivo NUNCA se ejecuta automáticamente.
 *
 * Se corre a mano, cuando se necesite. `DB_HOST=db` en el .env solo resuelve
 * dentro de la red de Docker (docker-compose.yml), así que si el proyecto
 * corre con `docker compose up`, este comando SIEMPRE debe correr dentro del
 * contenedor de la API, no desde la terminal del host:
 *   docker compose exec api npm run seed:demo
 * Si no usas Docker (Postgres/MariaDB local con DB_HOST=localhost en el
 * .env), sí sirve correrlo directo: npm run seed:demo
 *
 * Idempotente: si ya existe el espacio académico marcador
 * "Circuitos Eléctricos I (Demo)", asume que el dataset completo ya se
 * sembró y no hace nada — así correr el comando dos veces no duplica datos.
 * Requiere que ya exista la base (roles, admin, usuarios demo, catálogos,
 * laboratorios) — se crea sola al levantar la app normalmente, por eso este
 * script arranca un ApplicationContext completo (dispara ese seed base) en
 * vez de abrir su propia conexión a mano.
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';
import { EspacioAcademico } from 'src/catalogos/entities/espacio-academico.entity';
import { EspacioLaboratorio } from 'src/laboratorios/entities/espacio-laboratorio.entity';
import { DocenteLaboratorio } from 'src/laboratorios/entities/docente-laboratorio.entity';
import { TipoReserva } from 'src/catalogos/entities/tipo-reserva.entity';
import { Facultad } from 'src/catalogos/entities/facultad.entity';
import { PeriodoAcademico } from 'src/catalogos/entities/periodo-academico.entity';
import {
  DiaSemana,
  EstadoHorario,
  HorarioAcademico,
} from 'src/horarios-academicos/entities/horario-academico.entity';
import {
  EstadoSolicitud,
  SolicitudReserva,
} from 'src/solicitudes/entities/solicitud-reserva.entity';
import {
  Firma,
  ResultadoFirma,
  RolFirmante,
} from 'src/solicitudes/entities/firma.entity';
import { RegistroUso } from 'src/bitacora/entities/registro-uso.entity';

const MARCADOR_ESPACIO_DEMO = 'Circuitos Eléctricos I (Demo)';

async function obtenerReferencias(dataSource: DataSource) {
  const usuarioRepo = dataSource.getRepository(Usuario);
  const laboratorioRepo = dataSource.getRepository(Laboratorio);
  const tipoReservaRepo = dataSource.getRepository(TipoReserva);
  const facultadRepo = dataSource.getRepository(Facultad);
  const periodoRepo = dataSource.getRepository(PeriodoAcademico);

  const [estudiante, docente, laboratorista] = await Promise.all([
    usuarioRepo.findOneByOrFail({ correo: 'e@usantoto.edu.co' }),
    usuarioRepo.findOneByOrFail({ correo: 'd@usantoto.edu.co' }),
    usuarioRepo.findOneByOrFail({ correo: 'l@usantoto.edu.co' }),
  ]);
  const [labCircuitos, labElectronica] = await Promise.all([
    laboratorioRepo.findOneByOrFail({ nombre: 'Lab. Circuitos' }),
    laboratorioRepo.findOneByOrFail({ nombre: 'Lab. Electrónica Digital' }),
  ]);
  const [tipoDocencia, tipoPracticaLibre, tipoSemillero] = await Promise.all([
    tipoReservaRepo.findOneByOrFail({ nombre: 'Docencia' }),
    tipoReservaRepo.findOneByOrFail({ nombre: 'Práctica libre' }),
    tipoReservaRepo.findOneByOrFail({ nombre: 'Semillero' }),
  ]);
  const facultad = await facultadRepo.findOneByOrFail({
    nombre: 'Ingeniería Electrónica',
  });
  const periodo = await periodoRepo.findOneByOrFail({ nombre: '2026-2' });

  return {
    estudiante,
    docente,
    laboratorista,
    labCircuitos,
    labElectronica,
    tipoDocencia,
    tipoPracticaLibre,
    tipoSemillero,
    facultad,
    periodo,
  };
}

async function seedEspaciosYAsociaciones(
  dataSource: DataSource,
  refs: Awaited<ReturnType<typeof obtenerReferencias>>,
) {
  const espacioRepo = dataSource.getRepository(EspacioAcademico);
  const espacioLaboratorioRepo = dataSource.getRepository(EspacioLaboratorio);
  const docenteLaboratorioRepo = dataSource.getRepository(DocenteLaboratorio);

  const espacioCircuitos = await espacioRepo.save(
    espacioRepo.create({ nombre: MARCADOR_ESPACIO_DEMO }),
  );
  const espacioElectronica = await espacioRepo.save(
    espacioRepo.create({ nombre: 'Electrónica Digital I (Demo)' }),
  );
  console.log('Espacios académicos de ejemplo creados.');

  await espacioLaboratorioRepo.save([
    espacioLaboratorioRepo.create({
      idEspacio: espacioCircuitos.idEspacio,
      idLaboratorio: refs.labCircuitos.idLaboratorio,
    }),
    espacioLaboratorioRepo.create({
      idEspacio: espacioElectronica.idEspacio,
      idLaboratorio: refs.labElectronica.idLaboratorio,
    }),
  ]);
  await docenteLaboratorioRepo.save([
    docenteLaboratorioRepo.create({
      idUsuario: refs.docente.idUsuario,
      idLaboratorio: refs.labCircuitos.idLaboratorio,
    }),
    docenteLaboratorioRepo.create({
      idUsuario: refs.docente.idUsuario,
      idLaboratorio: refs.labElectronica.idLaboratorio,
    }),
  ]);
  console.log(
    'Asociaciones de ejemplo creadas (espacio-laboratorio, docente-laboratorio).',
  );

  return { espacioCircuitos, espacioElectronica };
}

async function seedHorarioAcademico(
  dataSource: DataSource,
  refs: Awaited<ReturnType<typeof obtenerReferencias>>,
  espacioElectronica: EspacioAcademico,
) {
  const horarioRepo = dataSource.getRepository(HorarioAcademico);

  await horarioRepo.save(
    horarioRepo.create({
      idLaboratorio: refs.labElectronica.idLaboratorio,
      idEspacio: espacioElectronica.idEspacio,
      idDocente: refs.docente.idUsuario,
      idPeriodo: refs.periodo.idPeriodo,
      grupoAsignatura: 'G1 (Demo)',
      diaSemana: DiaSemana.LUNES,
      horaInicio: '08:00',
      horaFin: '10:00',
      estado: EstadoHorario.VIGENTE,
    }),
  );
  console.log(
    'Horario académico de ejemplo creado (bloquea el calendario los lunes 08:00-10:00).',
  );
}

async function seedSolicitudesYFirmas(
  dataSource: DataSource,
  refs: Awaited<ReturnType<typeof obtenerReferencias>>,
  espacios: {
    espacioCircuitos: EspacioAcademico;
    espacioElectronica: EspacioAcademico;
  },
) {
  const solicitudRepo = dataSource.getRepository(SolicitudReserva);
  const firmaRepo = dataSource.getRepository(Firma);

  const base = {
    idSolicitante: refs.estudiante.idUsuario,
    idDocenteEncargado: refs.docente.idUsuario,
    idFacultad: refs.facultad.idFacultad,
    idPeriodo: refs.periodo.idPeriodo,
    numPersonas: 8,
  };

  // A) recién creada, esperando la firma del docente encargado.
  const solicitudA = await solicitudRepo.save(
    solicitudRepo.create({
      ...base,
      idLaboratorio: refs.labCircuitos.idLaboratorio,
      idTipo: refs.tipoPracticaLibre.idTipo,
      fechaPractica: '2026-07-29',
      horaInicio: '10:00',
      horaFin: '12:00',
      nombrePractica: '[Demo] Práctica de circuitos RC',
      estado: EstadoSolicitud.PENDIENTE_DOCENTE,
    }),
  );
  await firmaRepo.save([
    firmaRepo.create({
      idSolicitud: solicitudA.idSolicitud,
      orden: 1,
      rolFirmante: RolFirmante.DOCENTE,
      idFirmante: refs.docente.idUsuario,
      resultado: ResultadoFirma.PENDIENTE,
    }),
    firmaRepo.create({
      idSolicitud: solicitudA.idSolicitud,
      orden: 2,
      rolFirmante: RolFirmante.LABORATORISTA,
      resultado: ResultadoFirma.PENDIENTE,
    }),
  ]);

  // B) el docente ya firmó, esperando laboratorista (bandeja compartida).
  const solicitudB = await solicitudRepo.save(
    solicitudRepo.create({
      ...base,
      idLaboratorio: refs.labCircuitos.idLaboratorio,
      idTipo: refs.tipoSemillero.idTipo,
      fechaPractica: '2026-08-03',
      horaInicio: '14:00',
      horaFin: '16:00',
      nombrePractica: '[Demo] Semillero de robótica',
      estado: EstadoSolicitud.PENDIENTE_LABORATORISTA,
    }),
  );
  await firmaRepo.save([
    firmaRepo.create({
      idSolicitud: solicitudB.idSolicitud,
      orden: 1,
      rolFirmante: RolFirmante.DOCENTE,
      idFirmante: refs.docente.idUsuario,
      resultado: ResultadoFirma.APROBADA,
      fechaHora: new Date('2026-07-25T09:00:00'),
    }),
    firmaRepo.create({
      idSolicitud: solicitudB.idSolicitud,
      orden: 2,
      rolFirmante: RolFirmante.LABORATORISTA,
      resultado: ResultadoFirma.PENDIENTE,
    }),
  ]);

  // C) aprobada — ya pasó, sirve para enlazar un registro de bitácora real.
  const solicitudC = await solicitudRepo.save(
    solicitudRepo.create({
      ...base,
      idLaboratorio: refs.labCircuitos.idLaboratorio,
      idTipo: refs.tipoPracticaLibre.idTipo,
      idEspacio: espacios.espacioCircuitos.idEspacio,
      fechaPractica: '2026-07-15',
      horaInicio: '08:00',
      horaFin: '10:00',
      nombrePractica: '[Demo] Práctica de filtros activos',
      estado: EstadoSolicitud.APROBADA,
    }),
  );
  await firmaRepo.save([
    firmaRepo.create({
      idSolicitud: solicitudC.idSolicitud,
      orden: 1,
      rolFirmante: RolFirmante.DOCENTE,
      idFirmante: refs.docente.idUsuario,
      resultado: ResultadoFirma.APROBADA,
      fechaHora: new Date('2026-07-10T09:00:00'),
    }),
    firmaRepo.create({
      idSolicitud: solicitudC.idSolicitud,
      orden: 2,
      rolFirmante: RolFirmante.LABORATORISTA,
      idFirmante: refs.laboratorista.idUsuario,
      resultado: ResultadoFirma.APROBADA,
      fechaHora: new Date('2026-07-11T15:00:00'),
    }),
  ]);

  // D) rechazada por el laboratorista, con motivo.
  const solicitudD = await solicitudRepo.save(
    solicitudRepo.create({
      ...base,
      idLaboratorio: refs.labElectronica.idLaboratorio,
      idTipo: refs.tipoPracticaLibre.idTipo,
      fechaPractica: '2026-08-05',
      horaInicio: '10:00',
      horaFin: '12:00',
      nombrePractica: '[Demo] Práctica de amplificadores operacionales',
      estado: EstadoSolicitud.RECHAZADA,
    }),
  );
  await firmaRepo.save([
    firmaRepo.create({
      idSolicitud: solicitudD.idSolicitud,
      orden: 1,
      rolFirmante: RolFirmante.DOCENTE,
      idFirmante: refs.docente.idUsuario,
      resultado: ResultadoFirma.APROBADA,
      fechaHora: new Date('2026-07-26T09:00:00'),
    }),
    firmaRepo.create({
      idSolicitud: solicitudD.idSolicitud,
      orden: 2,
      rolFirmante: RolFirmante.LABORATORISTA,
      idFirmante: refs.laboratorista.idUsuario,
      resultado: ResultadoFirma.RECHAZADA,
      motivoRechazo: 'Equipos de medición en mantenimiento esa semana.',
      fechaHora: new Date('2026-07-27T11:00:00'),
    }),
  ]);

  // E) cancelada por el propio estudiante.
  const solicitudE = await solicitudRepo.save(
    solicitudRepo.create({
      ...base,
      idLaboratorio: refs.labCircuitos.idLaboratorio,
      idTipo: refs.tipoPracticaLibre.idTipo,
      fechaPractica: '2026-08-10',
      horaInicio: '08:00',
      horaFin: '10:00',
      nombrePractica: '[Demo] Práctica de filtros pasivos',
      estado: EstadoSolicitud.CANCELADA,
      motivoCancelacion: 'Cambio de horario de clase.',
    }),
  );
  await firmaRepo.save(
    firmaRepo.create({
      idSolicitud: solicitudE.idSolicitud,
      orden: 1,
      rolFirmante: RolFirmante.DOCENTE,
      resultado: ResultadoFirma.PENDIENTE,
    }),
  );

  // F) el propio docente crea una reserva exclusiva (Docencia) — 1 sola firma.
  const solicitudF = await solicitudRepo.save(
    solicitudRepo.create({
      idSolicitante: refs.docente.idUsuario,
      idDocenteEncargado: refs.docente.idUsuario,
      idFacultad: refs.facultad.idFacultad,
      idPeriodo: refs.periodo.idPeriodo,
      idLaboratorio: refs.labElectronica.idLaboratorio,
      idTipo: refs.tipoDocencia.idTipo,
      idEspacio: espacios.espacioElectronica.idEspacio,
      fechaPractica: '2026-08-12',
      horaInicio: '08:00',
      horaFin: '10:00',
      nombrePractica: '[Demo] Clase de electrónica digital',
      numPersonas: 24,
      grupoAsignatura: 'G1',
      estado: EstadoSolicitud.PENDIENTE_LABORATORISTA,
    }),
  );
  await firmaRepo.save(
    firmaRepo.create({
      idSolicitud: solicitudF.idSolicitud,
      orden: 1,
      rolFirmante: RolFirmante.LABORATORISTA,
      resultado: ResultadoFirma.PENDIENTE,
    }),
  );

  console.log(
    '6 solicitudes de ejemplo creadas (con sus firmas), en distintos estados.',
  );
  return { solicitudAprobada: solicitudC };
}

async function seedBitacora(
  dataSource: DataSource,
  refs: Awaited<ReturnType<typeof obtenerReferencias>>,
  solicitudAprobada: SolicitudReserva,
) {
  const registroUsoRepo = dataSource.getRepository(RegistroUso);

  await registroUsoRepo.save([
    registroUsoRepo.create({
      idSolicitud: solicitudAprobada.idSolicitud,
      idLaboratorio: refs.labCircuitos.idLaboratorio,
      idLaboratorista: refs.laboratorista.idUsuario,
      idTipo: refs.tipoPracticaLibre.idTipo,
      fecha: '2026-07-15',
      horaInicioReal: '08:05',
      horaFinReal: '09:55',
      numAsistentes: 7,
      observaciones: '[Demo] Sesión sin novedad.',
    }),
    registroUsoRepo.create({
      idLaboratorio: refs.labElectronica.idLaboratorio,
      idLaboratorista: refs.laboratorista.idUsuario,
      idTipo: refs.tipoSemillero.idTipo,
      fecha: '2026-07-10',
      horaInicioReal: '15:00',
      horaFinReal: '17:00',
      numAsistentes: 5,
      novedad: 'Docente ausente',
      observaciones:
        '[Demo] Uso sin reserva asociada (eventualidad histórica).',
    }),
  ]);
  console.log('2 registros de bitácora de ejemplo creados.');
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    const espacioRepo = dataSource.getRepository(EspacioAcademico);

    const yaSembrado = await espacioRepo.exists({
      where: { nombre: MARCADOR_ESPACIO_DEMO },
    });
    if (yaSembrado) {
      console.log(
        'Los datos de ejemplo ya existen (se detectó el espacio académico marcador). Nada que hacer.',
      );
      return;
    }

    const refs = await obtenerReferencias(dataSource);
    const espacios = await seedEspaciosYAsociaciones(dataSource, refs);
    await seedHorarioAcademico(dataSource, refs, espacios.espacioElectronica);
    const { solicitudAprobada } = await seedSolicitudesYFirmas(
      dataSource,
      refs,
      espacios,
    );
    await seedBitacora(dataSource, refs, solicitudAprobada);

    console.log('\nDatos de ejemplo sembrados correctamente.');
    console.log(
      'Inicia sesión con e@usantoto.edu.co / d@usantoto.edu.co / l@usantoto.edu.co (clave: 12345678) para verlos.',
    );
  } finally {
    await app.close();
  }
}

bootstrap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error al sembrar los datos de ejemplo:', error);
    process.exit(1);
  });
