import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { JwtGuard } from '../src/auth/jwt/jwt.guard';
import { AuthenticatedUser } from '../src/auth/decorators/current-user.decorator';
import {
  Usuario,
  EstadoUsuario,
} from '../src/usuarios/entities/usuario.entity';
import { Rol } from '../src/roles/entities/rol.entity';
import { Division } from '../src/catalogos/entities/division.entity';
import { Facultad } from '../src/catalogos/entities/facultad.entity';
import { PeriodoAcademico } from '../src/catalogos/entities/periodo-academico.entity';
import { EspacioAcademico } from '../src/catalogos/entities/espacio-academico.entity';
import { EspacioLaboratorio } from '../src/laboratorios/entities/espacio-laboratorio.entity';
import { TipoReserva } from '../src/catalogos/entities/tipo-reserva.entity';
import { Laboratorio } from '../src/laboratorios/entities/laboratorio.entity';
import { DocenteLaboratorio } from '../src/laboratorios/entities/docente-laboratorio.entity';
import { LaboratoristaLaboratorio } from '../src/laboratorios/entities/laboratorista-laboratorio.entity';
import { SolicitudReserva } from '../src/solicitudes/entities/solicitud-reserva.entity';
import { Firma } from '../src/solicitudes/entities/firma.entity';
import { SolicitudEvento } from '../src/solicitudes/entities/solicitud-evento.entity';
import { Notificacion } from '../src/notificaciones/entities/notificacion.entity';

/**
 * Evento especial (varios días, admin/laboratorista) — ver el mismo patrón
 * y las mismas justificaciones de flujo-completo-reserva.e2e-spec.ts (JwtGuard
 * parchado, base de datos real). Cubre POST /solicitudes/directa-lote y
 * POST /solicitudes/lote/:idLoteEspecial/cancelar.
 *
 * A diferencia de la primera versión de esta feature, hoy "reserva especial"
 * usa los MISMOS campos que una reserva normal (tipo, horario, aforo,
 * docente encargado, facultad, periodo) — el único campo propio es
 * `responsable` (texto libre) — y el mismo horario se valida/aplica a TODAS
 * las fechas del lote (ver CreateSolicitudDirectaLoteDto).
 */

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

jest.setTimeout(20000);

describe('Evento especial de varios días (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const sufijo = Date.now();

  let server: App;
  const as = (idUsuario: string) => ({
    post: (url: string) =>
      request(server).post(url).set('x-e2e-user-id', idUsuario),
    get: (url: string) =>
      request(server).get(url).set('x-e2e-user-id', idUsuario),
    patch: (url: string) =>
      request(server).patch(url).set('x-e2e-user-id', idUsuario),
    delete: (url: string) =>
      request(server).delete(url).set('x-e2e-user-id', idUsuario),
  });

  let admin: Usuario;
  let laboratorista: Usuario;
  let docente: Usuario;

  let idDivision: number;
  let idFacultad: number;
  let idLaboratorio: number;
  let idLaboratorioServicio: number;
  let idPeriodo: number;
  let idTipoPracticaLibre: number;
  let idTipoDocencia: number;
  let idEspacio: number;
  let idEspacioServicio: number;
  let idsSolicitudesCreadas: number[] = [];
  const idsSolicitudesServicio: number[] = [];

  const dtoLote = (overrides: Record<string, unknown>) => ({
    idDocenteEncargado: docente.idUsuario,
    responsable: `Comité de Bienestar E2E ${sufijo}`,
    idTipo: idTipoPracticaLibre,
    idEspacio,
    idFacultad,
    idPeriodo,
    grupoAsignatura: 'G1',
    numGruposTrabajo: 1,
    horaInicio: '08:00',
    horaFin: '10:00',
    nombrePractica: `Feria de ciencias E2E ${sufijo}`,
    numPersonas: 30,
    ...overrides,
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    dataSource = app.get(DataSource);
    server = app.getHttpServer();

    jest
      .spyOn(JwtGuard.prototype, 'canActivate')
      .mockImplementation(async (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest();
        const idUsuario = req.headers['x-e2e-user-id'];
        if (!idUsuario) return false;
        const usuario = await dataSource.getRepository(Usuario).findOne({
          where: { idUsuario },
          relations: { rol: true },
        });
        if (!usuario) return false;
        const authenticated: AuthenticatedUser = {
          id: usuario.idUsuario,
          nombre: usuario.nombre,
          correo: usuario.correo,
          rol: usuario.rol.nombre,
          cargo: usuario.cargo ?? null,
          facultad: usuario.facultad ?? null,
        };
        req.user = authenticated;
        return true;
      });

    const rolRepo = dataSource.getRepository(Rol);
    const usuarioRepo = dataSource.getRepository(Usuario);
    const [rolAdmin, rolDocente, rolLaboratorista] = await Promise.all([
      rolRepo.findOneByOrFail({ nombre: 'admin' }),
      rolRepo.findOneByOrFail({ nombre: 'docente' }),
      rolRepo.findOneByOrFail({ nombre: 'laboratorista' }),
    ]);

    [admin, docente, laboratorista] = await usuarioRepo.save([
      usuarioRepo.create({
        nombre: `E2E Admin Evento ${sufijo}`,
        correo: `e2e-admin-evento-${sufijo}@test.local`,
        rol: rolAdmin,
        estado: EstadoUsuario.ACTIVO,
      }),
      usuarioRepo.create({
        nombre: `E2E Docente Evento ${sufijo}`,
        correo: `e2e-docente-evento-${sufijo}@test.local`,
        rol: rolDocente,
        estado: EstadoUsuario.ACTIVO,
      }),
      usuarioRepo.create({
        nombre: `E2E Laboratorista Evento ${sufijo}`,
        correo: `e2e-laboratorista-evento-${sufijo}@test.local`,
        rol: rolLaboratorista,
        estado: EstadoUsuario.ACTIVO,
      }),
    ]);

    const tipoPracticaLibre = await dataSource
      .getRepository(TipoReserva)
      .findOneByOrFail({ nombre: 'Práctica libre' });
    idTipoPracticaLibre = tipoPracticaLibre.idTipo;

    const tipoDocencia = await dataSource
      .getRepository(TipoReserva)
      .findOneByOrFail({ nombre: 'Docencia' });
    idTipoDocencia = tipoDocencia.idTipo;

    const divisionRes = await as(admin.idUsuario)
      .post('/divisiones')
      .send({
        nombre: `División Evento E2E ${sufijo}`,
        facultades: [{ nombre: `Facultad Evento E2E ${sufijo}` }],
      })
      .expect(201);
    idDivision = divisionRes.body.idDivision;

    const facultadRes = await as(admin.idUsuario)
      .post('/facultades')
      .send({ nombre: `Facultad Evento E2E 2 ${sufijo}`, idDivision })
      .expect(201);
    idFacultad = facultadRes.body.idFacultad;

    const laboratorioRes = await as(admin.idUsuario)
      .post('/laboratorios')
      .send({
        nombre: `Laboratorio Evento E2E ${sufijo}`,
        capacidad: 50,
        modoReserva: 'estandar',
      })
      .expect(201);
    idLaboratorio = laboratorioRes.body.idLaboratorio;

    // idEspacio/grupoAsignatura/numGruposTrabajo son obligatorios para
    // cualquier tipo de reserva (formato EATUF) — hace falta un espacio
    // académico asociado a idLaboratorio para poder crear cualquier evento.
    const espacioRes = await as(admin.idUsuario)
      .post('/espacios-academicos')
      .send({ nombre: `Espacio Evento E2E ${sufijo}` })
      .expect(201);
    idEspacio = espacioRes.body.idEspacio;
    await as(admin.idUsuario)
      .post(`/laboratorios/${idLaboratorio}/espacios-academicos`)
      .send({ idEspacio })
      .expect(201);

    const laboratorioServicioRes = await as(admin.idUsuario)
      .post('/laboratorios')
      .send({
        nombre: `Laboratorio Servicio Evento E2E ${sufijo}`,
        modoReserva: 'laboratorio_como_servicio',
      })
      .expect(201);
    idLaboratorioServicio = laboratorioServicioRes.body.idLaboratorio;

    // "Como servicio" siempre queda con capacidad null (ver
    // LaboratoriosService.validarCapacidadPorModo) — para el evento especial
    // ahí abajo hace falta un tipo EXCLUSIVO (Docencia, ver verificarDisponibilidad:
    // sin exclusividad, capacidad null ?? 0 rechazaría cualquier numPersonas > 0),
    // y Docencia exige espacio académico.
    const espacioServicioRes = await as(admin.idUsuario)
      .post('/espacios-academicos')
      .send({ nombre: `Espacio Servicio Evento E2E ${sufijo}` })
      .expect(201);
    idEspacioServicio = espacioServicioRes.body.idEspacio;
    await as(admin.idUsuario)
      .post(`/laboratorios/${idLaboratorioServicio}/espacios-academicos`)
      .send({ idEspacio: idEspacioServicio })
      .expect(201);

    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - 30);
    const fin = new Date(hoy);
    fin.setDate(fin.getDate() + 120);
    const periodoRes = await as(admin.idUsuario)
      .post('/periodos-academicos')
      .send({
        nombre: `EvE-${sufijo}`.slice(0, 20),
        fechaInicio: isoDate(inicio),
        fechaFin: isoDate(fin),
        numSemanas: 16,
      })
      .expect(201);
    idPeriodo = periodoRes.body.idPeriodo;

    await as(admin.idUsuario)
      .post(`/laboratorios/${idLaboratorio}/docentes-encargados`)
      .send({ idUsuario: docente.idUsuario })
      .expect(201);

    await as(admin.idUsuario)
      .post(`/laboratorios/${idLaboratorio}/laboratoristas-encargados`)
      .send({ idUsuario: laboratorista.idUsuario })
      .expect(201);

    // idLaboratorioServicio: solo el docente queda asociado — el
    // laboratorista deliberadamente NO, para poder probar el 403 de "no
    // estás a cargo de este laboratorio" (ver el test correspondiente).
    // Todo lo demás (crearlo, cancelar/archivar) lo hace el admin, que
    // nunca necesita estar asociado.
    await as(admin.idUsuario)
      .post(`/laboratorios/${idLaboratorioServicio}/docentes-encargados`)
      .send({ idUsuario: docente.idUsuario })
      .expect(201);
  });

  afterAll(async () => {
    try {
      if (idsSolicitudesCreadas.length > 0) {
        for (const idSolicitud of idsSolicitudesCreadas) {
          await dataSource.getRepository(Notificacion).delete({ idSolicitud });
          await dataSource
            .getRepository(SolicitudEvento)
            .delete({ idSolicitud });
          await dataSource.getRepository(Firma).delete({ idSolicitud });
        }
        await dataSource
          .getRepository(SolicitudReserva)
          .delete(idsSolicitudesCreadas);
      }
      if (idsSolicitudesServicio.length > 0) {
        for (const idSolicitud of idsSolicitudesServicio) {
          await dataSource.getRepository(Notificacion).delete({ idSolicitud });
          await dataSource
            .getRepository(SolicitudEvento)
            .delete({ idSolicitud });
          await dataSource.getRepository(Firma).delete({ idSolicitud });
        }
        await dataSource
          .getRepository(SolicitudReserva)
          .delete(idsSolicitudesServicio);
      }
      if (idLaboratorio) {
        await dataSource
          .getRepository(DocenteLaboratorio)
          .delete({ idLaboratorio });
        await dataSource
          .getRepository(LaboratoristaLaboratorio)
          .delete({ idLaboratorio });
        await dataSource
          .getRepository(EspacioLaboratorio)
          .delete({ idLaboratorio });
        await dataSource.getRepository(Laboratorio).delete({ idLaboratorio });
      }
      if (idLaboratorioServicio) {
        await dataSource
          .getRepository(DocenteLaboratorio)
          .delete({ idLaboratorio: idLaboratorioServicio });
        await dataSource
          .getRepository(EspacioLaboratorio)
          .delete({ idLaboratorio: idLaboratorioServicio });
        await dataSource
          .getRepository(Laboratorio)
          .delete({ idLaboratorio: idLaboratorioServicio });
      }
      if (idEspacio) {
        await dataSource
          .getRepository(EspacioAcademico)
          .delete({ idEspacio });
      }
      if (idEspacioServicio) {
        await dataSource
          .getRepository(EspacioAcademico)
          .delete({ idEspacio: idEspacioServicio });
      }
      if (idPeriodo) {
        await dataSource.getRepository(PeriodoAcademico).delete({ idPeriodo });
      }
      if (idDivision) {
        await dataSource.getRepository(Facultad).delete({ idDivision });
        await dataSource.getRepository(Division).delete({ idDivision });
      }
      await dataSource
        .getRepository(Usuario)
        .delete([admin.idUsuario, docente.idUsuario, laboratorista.idUsuario]);
    } finally {
      jest.restoreAllMocks();
      await app.close();
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    }
  });

  it('laboratorista crea un evento especial de 3 días: 3 solicitudes aprobadas con el mismo idLoteEspecial y el MISMO horario/tipo/aforo/responsable en todas', async () => {
    const fechas = [10, 11, 12].map((dias) => {
      const f = new Date();
      f.setDate(f.getDate() + dias);
      return isoDate(f);
    });

    const res = await as(laboratorista.idUsuario)
      .post('/solicitudes/directa-lote')
      .send({ ...dtoLote({}), idLaboratorio, fechas })
      .expect(201);

    expect(res.body).toHaveLength(3);
    idsSolicitudesCreadas = res.body.map(
      (s: { idSolicitud: number }) => s.idSolicitud,
    );

    const lotes = new Set(
      res.body.map((s: { idLoteEspecial: string }) => s.idLoteEspecial),
    );
    expect(lotes.size).toBe(1);
    expect([...lotes][0]).toBeTruthy();

    for (const solicitud of res.body) {
      expect(solicitud.estado).toBe('aprobada');
      expect(solicitud.horaInicio.startsWith('08:00')).toBe(true);
      expect(solicitud.horaFin.startsWith('10:00')).toBe(true);
      expect(solicitud.numPersonas).toBe(30);
      expect(solicitud.idTipo).toBe(idTipoPracticaLibre);
      expect(solicitud.idDocenteEncargado).toBe(docente.idUsuario);
      expect(solicitud.responsable).toBe(`Comité de Bienestar E2E ${sufijo}`);
    }

    const fechasCreadas = res.body
      .map((s: { fechaPractica: string }) => s.fechaPractica)
      .sort();
    expect(fechasCreadas).toEqual([...fechas].sort());
  });

  it('todo o nada: si una fecha del lote choca en aforo con lo ya aprobado, no crea ninguna', async () => {
    const fechaOcupada = new Date();
    fechaOcupada.setDate(fechaOcupada.getDate() + 10); // misma fecha/horario que el primer test (30 personas ya aprobadas)
    const fechaLibre1 = new Date();
    fechaLibre1.setDate(fechaLibre1.getDate() + 20);
    const fechaLibre2 = new Date();
    fechaLibre2.setDate(fechaLibre2.getDate() + 21);

    const antesDelIntento = idsSolicitudesCreadas.length;

    await as(laboratorista.idUsuario)
      .post('/solicitudes/directa-lote')
      .send({
        ...dtoLote({
          numPersonas: 25,
          nombrePractica: `Feria que choca E2E ${sufijo}`,
        }),
        idLaboratorio,
        fechas: [
          isoDate(fechaLibre1),
          isoDate(fechaOcupada), // 30 + 25 > capacidad (50)
          isoDate(fechaLibre2),
        ],
      })
      .expect(409);

    const totalActual = await dataSource
      .getRepository(SolicitudReserva)
      .count({ where: { idLaboratorio } });
    // Las 3 del primer test siguen ahí, y NINGUNA de este intento se creó.
    expect(totalActual).toBe(antesDelIntento);
  });

  it('rechaza el lote si lo intenta un rol sin permiso (docente)', async () => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 30);

    await as(docente.idUsuario)
      .post('/solicitudes/directa-lote')
      .send({ ...dtoLote({}), idLaboratorio, fechas: [isoDate(fecha)] })
      .expect(403);
  });

  it('rechaza el lote si el laboratorista no está a cargo de ese laboratorio', async () => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 31);

    await as(laboratorista.idUsuario)
      .post('/solicitudes/directa-lote')
      .send({
        ...dtoLote({}),
        idLaboratorio: idLaboratorioServicio,
        fechas: [isoDate(fecha)],
      })
      .expect(403);
  });

  it('admin crea un evento especial en un laboratorio "como servicio" (capacidad null, tipo exclusivo)', async () => {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 45);

    const res = await as(admin.idUsuario)
      .post('/solicitudes/directa-lote')
      .send({
        ...dtoLote({
          idTipo: idTipoDocencia,
          idEspacio: idEspacioServicio,
          numPersonas: 10,
          nombrePractica: `Capacitación equipos E2E ${sufijo}`,
        }),
        idLaboratorio: idLaboratorioServicio,
        fechas: [isoDate(fecha)],
      })
      .expect(201);

    expect(res.body).toHaveLength(1);
    idsSolicitudesServicio.push(res.body[0].idSolicitud);
    expect(res.body[0].estado).toBe('aprobada');
    expect(res.body[0].idDocenteEncargado).toBe(docente.idUsuario);
  });

  it('admin cancela todo el evento especial de un golpe', async () => {
    const solicitudCreada = await dataSource
      .getRepository(SolicitudReserva)
      .findOneByOrFail({ idSolicitud: idsSolicitudesCreadas[0] });
    const idLoteEspecial = solicitudCreada.idLoteEspecial as string;

    const cancelacion = await as(admin.idUsuario)
      .post(`/solicitudes/lote/${idLoteEspecial}/cancelar`)
      .send({ motivoCancelacion: 'Evento cancelado (e2e)' })
      .expect(201);

    expect(cancelacion.body).toHaveLength(3);
    for (const solicitud of cancelacion.body) {
      expect(solicitud.estado).toBe('cancelada');
    }
  });

  it('rechaza archivarLote/desarchivarLote/vaciar para un rol sin permiso (docente)', async () => {
    const solicitudCreada = await dataSource
      .getRepository(SolicitudReserva)
      .findOneByOrFail({ idSolicitud: idsSolicitudesCreadas[0] });
    const idLoteEspecial = solicitudCreada.idLoteEspecial as string;

    await as(docente.idUsuario)
      .patch(`/solicitudes/lote/${idLoteEspecial}/archivar`)
      .expect(403);
    await as(docente.idUsuario)
      .patch(`/solicitudes/lote/${idLoteEspecial}/desarchivar`)
      .expect(403);
    await as(docente.idUsuario)
      .delete('/solicitudes/lote/archivadas')
      .expect(403);
  });

  it('laboratorista archiva un evento que NO creó él (ya cancelado por admin) — desaparece para todos', async () => {
    const solicitudCreada = await dataSource
      .getRepository(SolicitudReserva)
      .findOneByOrFail({ idSolicitud: idsSolicitudesCreadas[0] });
    const idLoteEspecial = solicitudCreada.idLoteEspecial as string;

    const res = await as(laboratorista.idUsuario)
      .patch(`/solicitudes/lote/${idLoteEspecial}/archivar`)
      .expect(200);

    expect(res.body).toHaveLength(3);
    for (const solicitud of res.body) {
      expect(solicitud.archivada).toBe(true);
    }

    const noEspeciales = await as(admin.idUsuario)
      .get('/solicitudes/mias?soloEspeciales=true')
      .expect(200);
    for (const solicitud of noEspeciales.body) {
      expect(solicitud.idLoteEspecial).not.toBe(idLoteEspecial);
    }
  });

  it('desarchivarLote restaura el evento (vuelve a verse)', async () => {
    const solicitudCreada = await dataSource
      .getRepository(SolicitudReserva)
      .findOneByOrFail({ idSolicitud: idsSolicitudesCreadas[0] });
    const idLoteEspecial = solicitudCreada.idLoteEspecial as string;

    const res = await as(admin.idUsuario)
      .patch(`/solicitudes/lote/${idLoteEspecial}/desarchivar`)
      .expect(200);

    expect(res.body).toHaveLength(3);
    for (const solicitud of res.body) {
      expect(solicitud.archivada).toBe(false);
    }
  });

  it('vaciarArchivadasEspeciales borra definitivamente las archivadas de cualquier evento', async () => {
    const solicitudCreada = await dataSource
      .getRepository(SolicitudReserva)
      .findOneByOrFail({ idSolicitud: idsSolicitudesCreadas[0] });
    const idLoteEspecial = solicitudCreada.idLoteEspecial as string;

    await as(laboratorista.idUsuario)
      .patch(`/solicitudes/lote/${idLoteEspecial}/archivar`)
      .expect(200);

    const res = await as(admin.idUsuario)
      .delete('/solicitudes/lote/archivadas')
      .expect(200);

    expect(res.body.eliminadas).toBeGreaterThanOrEqual(3);

    // Soft delete (eliminada=true) — las filas siguen existiendo (Historial
    // no filtra por esto), no se borran físicamente. afterAll igual las
    // limpia por id.
    const restantes = await dataSource
      .getRepository(SolicitudReserva)
      .find({ where: { idLoteEspecial } });
    expect(restantes).toHaveLength(3);
    for (const solicitud of restantes) {
      expect(solicitud.eliminada).toBe(true);
    }
  });

  it('GET /solicitudes?soloEventosEspeciales=true solo trae solicitudes con idLoteEspecial', async () => {
    const res = await as(admin.idUsuario)
      .get('/solicitudes?soloEventosEspeciales=true&limit=100')
      .expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    for (const solicitud of res.body.data) {
      expect(solicitud.idLoteEspecial).toBeTruthy();
    }

    const idsDevueltos = new Set(
      res.body.data.map((s: { idSolicitud: number }) => s.idSolicitud),
    );
    for (const id of [...idsSolicitudesCreadas, ...idsSolicitudesServicio]) {
      expect(idsDevueltos.has(id)).toBe(true);
    }
  });

  it('GET /laboratorios/:id/eventos-especiales-mes solo trae las fechas de ese mes con reserva especial', async () => {
    const fechaEsperada = new Date();
    fechaEsperada.setDate(fechaEsperada.getDate() + 45);
    const fechaEsperadaIso = isoDate(fechaEsperada);

    const res = await as(admin.idUsuario)
      .get(
        `/laboratorios/${idLaboratorioServicio}/eventos-especiales-mes?year=${fechaEsperada.getFullYear()}&month=${fechaEsperada.getMonth() + 1}`,
      )
      .expect(200);

    expect(res.body).toContain(fechaEsperadaIso);

    // Un mes sin nada creado (muy en el pasado) no trae ninguna fecha.
    const vacio = await as(admin.idUsuario)
      .get(
        `/laboratorios/${idLaboratorioServicio}/eventos-especiales-mes?year=2020&month=1`,
      )
      .expect(200);
    expect(vacio.body).toEqual([]);
  });

  it('GET /solicitudes/mias?soloEspeciales=true|false separa las reservas especiales del resto en "Mis solicitudes"', async () => {
    const soloEspeciales = await as(admin.idUsuario)
      .get('/solicitudes/mias?soloEspeciales=true')
      .expect(200);
    const idsEspeciales = new Set(
      soloEspeciales.body.map((s: { idSolicitud: number }) => s.idSolicitud),
    );
    for (const id of idsSolicitudesServicio) {
      expect(idsEspeciales.has(id)).toBe(true);
    }
    for (const solicitud of soloEspeciales.body) {
      expect(solicitud.idLoteEspecial).toBeTruthy();
    }

    const sinEspeciales = await as(admin.idUsuario)
      .get('/solicitudes/mias?soloEspeciales=false')
      .expect(200);
    for (const solicitud of sinEspeciales.body) {
      expect(solicitud.idLoteEspecial).toBeFalsy();
    }
  });
});
