/**
 * Datos de ejemplo VOLUMINOSOS para poder probar
 * GET /reportes/asistencias-laboratorios/exportar contra las 35 salas / 14
 * hojas reales, sin depender de datos reales de producción — a diferencia de
 * `demo-seed.ts` (pensado para verse bien navegando la UI), este script solo
 * le importa exigir el export: cubre las 14 hojas, mezcla registros con y sin
 * solicitud asociada, tipos de reserva dentro y fuera de la lista cerrada de
 * "Uso de Laboratorio", y observaciones dentro y fuera de la lista cerrada —
 * los mismos casos que ya cubre `/exportar/validar`. No siembra firmas (no
 * hace falta para el export ni para el historial de solicitudes).
 *
 * Nunca se ejecuta solo. Correr a mano, dentro del contenedor si usas Docker:
 *   docker compose exec api npm run seed:reportes
 * Requiere que ya exista la base (roles, admin, usuarios demo, catálogos,
 * laboratorios, periodo académico) — se crea sola al levantar la app.
 *
 * Idempotente: si ya hay registros de bitácora marcados con el prefijo
 * "[SeedReportes]" en `observaciones`, no hace nada.
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';
import { TipoReserva } from 'src/catalogos/entities/tipo-reserva.entity';
import { Facultad } from 'src/catalogos/entities/facultad.entity';
import { PeriodoAcademico } from 'src/catalogos/entities/periodo-academico.entity';
import {
  EstadoSolicitud,
  SolicitudReserva,
} from 'src/solicitudes/entities/solicitud-reserva.entity';
import { RegistroUso } from 'src/bitacora/entities/registro-uso.entity';
import {
  LABORATORIO_A_HOJA,
  OBSERVACIONES_LISTA_CERRADA,
} from 'src/reportes/constantes/asistencias-excel.constants';

const MARCADOR = '[SeedReportes]';

const TIPOS_ROTACION = [
  'Práctica libre',
  'Investigación / Tesis',
  'Semillero', // fuera de la lista cerrada del Excel — a propósito.
  'CAU',
  'Marketing',
  'Servicios Externos',
];

const FRANJAS: Array<{ inicio: string; fin: string }> = [
  { inicio: '07:00', fin: '09:00' },
  { inicio: '09:00', fin: '11:00' },
  { inicio: '11:00', fin: '13:00' },
  { inicio: '14:00', fin: '16:00' },
  { inicio: '16:00', fin: '18:00' },
  { inicio: '18:00', fin: '20:00' },
];

const OBSERVACION_FUERA_DE_LISTA = 'Equipo audiovisual con falla';

function addDays(fechaIso: string, dias: number): string {
  const fecha = new Date(`${fechaIso}T00:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
  const inicio = new Date(`${desde}T00:00:00`).getTime();
  const fin = new Date(`${hasta}T00:00:00`).getTime();
  return Math.floor((fin - inicio) / (1000 * 60 * 60 * 24));
}

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

  const nombresLaboratorio = Object.keys(LABORATORIO_A_HOJA);
  const laboratorios = await Promise.all(
    nombresLaboratorio.map((nombre) =>
      laboratorioRepo.findOneByOrFail({ nombre }),
    ),
  );

  const tiposPorNombre = new Map(
    (
      await tipoReservaRepo.find({ where: TIPOS_ROTACION.map((n) => ({ nombre: n })) })
    ).map((t) => [t.nombre, t]),
  );

  const facultades = await facultadRepo.find({ order: { nombre: 'ASC' } });
  const periodo = await periodoRepo.findOneByOrFail({ nombre: '2026-2' });

  return {
    estudiante,
    docente,
    laboratorista,
    laboratorios,
    tiposPorNombre,
    facultades,
    periodo,
  };
}

async function sembrarRegistros(
  dataSource: DataSource,
  refs: Awaited<ReturnType<typeof obtenerReferencias>>,
): Promise<number> {
  const solicitudRepo = dataSource.getRepository(SolicitudReserva);
  const registroUsoRepo = dataSource.getRepository(RegistroUso);

  const totalDiasPeriodo = diasEntre(
    refs.periodo.fechaInicio,
    refs.periodo.fechaFin,
  );

  let n = 0;
  let creados = 0;

  for (const laboratorio of refs.laboratorios) {
    // 2 registros por laboratorio: suficiente volumen para ver todas las
    // hojas con varias filas cada una, sin sembrar miles de filas.
    for (let repeticion = 0; repeticion < 2; repeticion++) {
      const tipoNombre = TIPOS_ROTACION[n % TIPOS_ROTACION.length];
      const tipo = refs.tiposPorNombre.get(tipoNombre)!;
      const facultad = refs.facultades[n % refs.facultades.length];
      const franja = FRANJAS[n % FRANJAS.length];
      const fecha = addDays(refs.periodo.fechaInicio, n % totalDiasPeriodo);
      const novedad =
        n % 9 === 8
          ? OBSERVACION_FUERA_DE_LISTA
          : OBSERVACIONES_LISTA_CERRADA[n % OBSERVACIONES_LISTA_CERRADA.length];
      // 1 de cada 6 sin solicitud asociada — ejercita el caso
      // "sin_solicitud_asociada" de /exportar/validar.
      const sinSolicitud = n % 6 === 5;

      let idSolicitud: number | null = null;
      if (!sinSolicitud) {
        const solicitud = await solicitudRepo.save(
          solicitudRepo.create({
            idSolicitante: refs.estudiante.idUsuario,
            idDocenteEncargado: refs.docente.idUsuario,
            idLaboratorio: laboratorio.idLaboratorio,
            idTipo: tipo.idTipo,
            idFacultad: facultad.idFacultad,
            idPeriodo: refs.periodo.idPeriodo,
            fechaPractica: fecha,
            horaInicio: franja.inicio,
            horaFin: franja.fin,
            nombrePractica: `${MARCADOR} Uso de ${laboratorio.nombre}`,
            numPersonas: 5 + (n % 20),
            estado: EstadoSolicitud.APROBADA,
          }),
        );
        idSolicitud = solicitud.idSolicitud;
      }

      await registroUsoRepo.save(
        registroUsoRepo.create({
          idSolicitud,
          idLaboratorio: laboratorio.idLaboratorio,
          idLaboratorista: refs.laboratorista.idUsuario,
          idTipo: tipo.idTipo,
          fecha,
          horaInicioReal: franja.inicio,
          horaFinReal: franja.fin,
          numAsistentes: 5 + (n % 20),
          novedad,
          observaciones: `${MARCADOR} fila ${n + 1}`,
        }),
      );

      creados++;
      n++;
    }
  }

  return creados;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const dataSource = app.get(DataSource);
    const registroUsoRepo = dataSource.getRepository(RegistroUso);

    const yaSembrado = await registroUsoRepo
      .createQueryBuilder('registro')
      .where('registro.observaciones LIKE :marcador', {
        marcador: `${MARCADOR}%`,
      })
      .getExists();
    if (yaSembrado) {
      console.log(
        'Los datos de prueba de reportes ya existen (se detectó el marcador "[SeedReportes]"). Nada que hacer.',
      );
      return;
    }

    const refs = await obtenerReferencias(dataSource);
    const total = await sembrarRegistros(dataSource, refs);

    console.log(
      `\n${total} registros de bitácora de prueba sembrados, cubriendo las ${refs.laboratorios.length} salas / 14 hojas del Excel de asistencias.`,
    );
    console.log(
      'Prueba con GET /reportes/asistencias-laboratorios/exportar/validar y luego /exportar (roles admin o laboratorista).',
    );
  } finally {
    await app.close();
  }
}

bootstrap()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error al sembrar los datos de prueba de reportes:', error);
    process.exit(1);
  });
