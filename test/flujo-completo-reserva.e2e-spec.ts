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
import { TipoReserva } from '../src/catalogos/entities/tipo-reserva.entity';
import { Laboratorio } from '../src/laboratorios/entities/laboratorio.entity';
import { EspacioLaboratorio } from '../src/laboratorios/entities/espacio-laboratorio.entity';
import { DocenteLaboratorio } from '../src/laboratorios/entities/docente-laboratorio.entity';
import { LaboratoristaLaboratorio } from '../src/laboratorios/entities/laboratorista-laboratorio.entity';
import { HorarioAcademico } from '../src/horarios-academicos/entities/horario-academico.entity';
import { SolicitudReserva } from '../src/solicitudes/entities/solicitud-reserva.entity';
import { Firma } from '../src/solicitudes/entities/firma.entity';
import { SolicitudEvento } from '../src/solicitudes/entities/solicitud-evento.entity';
import { RegistroUso } from '../src/bitacora/entities/registro-uso.entity';
import { Notificacion } from '../src/notificaciones/entities/notificacion.entity';

/**
 * Recorre el flujo completo real (HTTP end-to-end, contra la base de datos
 * configurada en .env — mismo criterio que auth.e2e-spec.ts) desde la
 * creación de catálogos de administración hasta el cierre de una solicitud:
 *
 *   división (+facultad) -> laboratorio -> periodo académico ->
 *   espacio académico (+asociado al laboratorio) ->
 *   docente encargado y laboratorista asociados al laboratorio ->
 *   horario académico -> solicitud de reserva -> firma docente ->
 *   firma laboratorista (queda "aprobada") -> registro de bitácora
 *   (queda "realizada") -> archivar.
 *
 * Entra ID es la única fuente de identidad real (JwtStrategy valida firma
 * RS256 contra las llaves públicas de Microsoft — no se puede fabricar un
 * token válido en un test). Para poder "iniciar sesión" como distintos
 * roles en este flujo, se reemplaza JwtGuard.canActivate por un doble de
 * prueba que lee el id de usuario de un header custom (`x-e2e-user-id`) y
 * adjunta el mismo AuthenticatedUser que JwtStrategy.validate() arma
 * normalmente — el resto del pipeline (RolesGuard, controllers, services,
 * TypeORM, la base real) corre sin ningún mock, así que este test SÍ valida
 * las reglas de negocio reales (asociaciones requeridas, transiciones de
 * estado, permisos por rol), solo la verificación de la firma del JWT queda
 * fuera de alcance (igual que ya aclara auth.e2e-spec.ts).
 *
 * Se parcha `JwtGuard.prototype.canActivate` en vez de usar
 * `overrideGuard()` del TestingModuleBuilder: JwtGuard está registrado como
 * uno de VARIOS providers bajo el mismo token especial APP_GUARD (junto con
 * ThrottlerCustomGuard y RolesGuard, ver app.module.ts) — `overrideGuard()`
 * busca un provider cuyo token sea la clase misma, que acá no existe (el
 * token real es APP_GUARD), así que no hacía nada y las peticiones seguían
 * cayendo en el JwtGuard real (siempre 401 sin un JWT de Entra genuino).
 * Parchar el prototipo evita ese problema por completo: aplica sin importar
 * cómo Nest haya resuelto la instancia.
 */

/** 'YYYY-MM-DD' de una fecha, sin pasar por husos horarios de Date. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Firmar/registrar bitácora disparan notificaciones (MailService) además de
// las consultas reales a MySQL — el timeout por defecto de Jest (5s) a
// veces se queda corto para esos pasos.
jest.setTimeout(20000);

describe('Flujo completo de reserva (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const sufijo = Date.now();

  let server: App;
  const as = (idUsuario: string) => ({
    get: (url: string) =>
      request(server).get(url).set('x-e2e-user-id', idUsuario),
    post: (url: string) =>
      request(server).post(url).set('x-e2e-user-id', idUsuario),
    patch: (url: string) =>
      request(server).patch(url).set('x-e2e-user-id', idUsuario),
  });

  // Actores del flujo
  let admin: Usuario;
  let docente: Usuario;
  let estudiante: Usuario;
  let laboratorista: Usuario;

  // Recursos creados a lo largo del flujo
  let idDivision: number;
  let idFacultad: number;
  let idLaboratorio: number;
  let idPeriodo: number;
  let idEspacio: number;
  let idTipoPracticaLibre: number;
  let idHorario: number;
  let idSolicitud: number;
  let idRegistro: number;

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

    // Ver el comentario grande de arriba: se parcha el prototipo (no
    // overrideGuard) porque JwtGuard vive detrás del token multi-provider
    // APP_GUARD, no bajo su propio token. `dataSource` ya está asignado acá
    // arriba, así que el closure lo captura por referencia sin problema.
    jest
      .spyOn(JwtGuard.prototype, 'canActivate')
      .mockImplementation(async (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest();
        const idUsuario = req.headers['x-e2e-user-id'];
        if (!idUsuario) {
          return false;
        }
        const usuario = await dataSource.getRepository(Usuario).findOne({
          where: { idUsuario },
          relations: { rol: true },
        });
        if (!usuario) {
          return false;
        }
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
    const [rolAdmin, rolDocente, rolEstudiante, rolLaboratorista] =
      await Promise.all([
        rolRepo.findOneByOrFail({ nombre: 'admin' }),
        rolRepo.findOneByOrFail({ nombre: 'docente' }),
        rolRepo.findOneByOrFail({ nombre: 'estudiante' }),
        rolRepo.findOneByOrFail({ nombre: 'laboratorista' }),
      ]);

    [admin, docente, estudiante, laboratorista] = await usuarioRepo.save([
      usuarioRepo.create({
        nombre: `E2E Admin ${sufijo}`,
        correo: `e2e-admin-${sufijo}@test.local`,
        rol: rolAdmin,
        estado: EstadoUsuario.ACTIVO,
      }),
      usuarioRepo.create({
        nombre: `E2E Docente ${sufijo}`,
        correo: `e2e-docente-${sufijo}@test.local`,
        rol: rolDocente,
        estado: EstadoUsuario.ACTIVO,
      }),
      usuarioRepo.create({
        nombre: `E2E Estudiante ${sufijo}`,
        correo: `e2e-estudiante-${sufijo}@test.local`,
        rol: rolEstudiante,
        estado: EstadoUsuario.ACTIVO,
      }),
      usuarioRepo.create({
        nombre: `E2E Laboratorista ${sufijo}`,
        correo: `e2e-laboratorista-${sufijo}@test.local`,
        rol: rolLaboratorista,
        estado: EstadoUsuario.ACTIVO,
      }),
    ]);

    const tipoPracticaLibre = await dataSource
      .getRepository(TipoReserva)
      .findOneByOrFail({ nombre: 'Práctica libre' });
    idTipoPracticaLibre = tipoPracticaLibre.idTipo;
  });

  afterAll(async () => {
    // Limpieza en orden inverso de dependencias — solo lo que este test
    // creó (usuarios/división/laboratorio/periodo con sufijo único), nunca
    // el catálogo base (roles, tipos de reserva) que ya traía la base.
    try {
      if (idLaboratorio) {
        await dataSource.getRepository(RegistroUso).delete({ idLaboratorio });
      }
      if (idSolicitud) {
        await dataSource.getRepository(Notificacion).delete({ idSolicitud });
        await dataSource.getRepository(SolicitudEvento).delete({ idSolicitud });
        await dataSource.getRepository(Firma).delete({ idSolicitud });
        await dataSource
          .getRepository(SolicitudReserva)
          .delete({ idSolicitud });
      }
      if (idLaboratorio) {
        await dataSource
          .getRepository(HorarioAcademico)
          .delete({ idLaboratorio });
        await dataSource
          .getRepository(LaboratoristaLaboratorio)
          .delete({ idLaboratorio });
        await dataSource
          .getRepository(DocenteLaboratorio)
          .delete({ idLaboratorio });
        await dataSource
          .getRepository(EspacioLaboratorio)
          .delete({ idLaboratorio });
      }
      if (idEspacio) {
        await dataSource.getRepository(EspacioAcademico).delete({ idEspacio });
      }
      if (idLaboratorio) {
        await dataSource.getRepository(Laboratorio).delete({ idLaboratorio });
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
        .delete([
          admin.idUsuario,
          docente.idUsuario,
          estudiante.idUsuario,
          laboratorista.idUsuario,
        ]);
    } finally {
      jest.restoreAllMocks();
      await app.close();
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    }
  });

  it('admin crea una división con al menos una facultad', async () => {
    const res = await as(admin.idUsuario)
      .post('/divisiones')
      .send({
        nombre: `División E2E ${sufijo}`,
        facultades: [{ nombre: `Facultad base E2E ${sufijo}` }],
      })
      .expect(201);

    idDivision = res.body.idDivision;
    expect(idDivision).toBeDefined();
  });

  it('admin crea la facultad que va a usar la solicitud', async () => {
    const res = await as(admin.idUsuario)
      .post('/facultades')
      .send({ nombre: `Facultad E2E ${sufijo}`, idDivision })
      .expect(201);

    idFacultad = res.body.idFacultad;
    expect(idFacultad).toBeDefined();
  });

  it('admin crea un laboratorio en modo estándar', async () => {
    const res = await as(admin.idUsuario)
      .post('/laboratorios')
      .send({
        nombre: `Laboratorio E2E ${sufijo}`,
        capacidad: 20,
        modoReserva: 'estandar',
      })
      .expect(201);

    idLaboratorio = res.body.idLaboratorio;
    expect(idLaboratorio).toBeDefined();
  });

  it('admin crea un periodo académico que cubre la fecha de la práctica', async () => {
    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setDate(inicio.getDate() - 30);
    const fin = new Date(hoy);
    fin.setDate(fin.getDate() + 60);

    const res = await as(admin.idUsuario)
      .post('/periodos-academicos')
      .send({
        nombre: `E2E-${sufijo}`,
        fechaInicio: isoDate(inicio),
        fechaFin: isoDate(fin),
        numSemanas: 16,
      })
      .expect(201);

    idPeriodo = res.body.idPeriodo;
    expect(idPeriodo).toBeDefined();
  });

  it('admin crea un espacio académico y lo asocia al laboratorio', async () => {
    const creado = await as(admin.idUsuario)
      .post('/espacios-academicos')
      .send({ nombre: `Espacio E2E ${sufijo}` })
      .expect(201);
    idEspacio = creado.body.idEspacio;
    expect(idEspacio).toBeDefined();

    await as(admin.idUsuario)
      .post(`/laboratorios/${idLaboratorio}/espacios-academicos`)
      .send({ idEspacio })
      .expect(201);
  });

  it('admin asocia el docente encargado al laboratorio', async () => {
    await as(admin.idUsuario)
      .post(`/laboratorios/${idLaboratorio}/docentes-encargados`)
      .send({ idUsuario: docente.idUsuario })
      .expect(201);

    const res = await as(admin.idUsuario)
      .get(`/laboratorios/${idLaboratorio}/docentes-encargados`)
      .expect(200);
    expect(res.body.map((d: { idUsuario: string }) => d.idUsuario)).toContain(
      docente.idUsuario,
    );
  });

  it('admin asocia el laboratorista a cargo del laboratorio (trazabilidad)', async () => {
    await as(admin.idUsuario)
      .post(`/laboratorios/${idLaboratorio}/laboratoristas-encargados`)
      .send({ idUsuario: laboratorista.idUsuario })
      .expect(201);

    const res = await as(admin.idUsuario)
      .get(`/laboratorios/${idLaboratorio}/laboratoristas-encargados`)
      .expect(200);
    expect(res.body.map((l: { idUsuario: string }) => l.idUsuario)).toContain(
      laboratorista.idUsuario,
    );
  });

  it('admin crea un horario académico para el laboratorio', async () => {
    const res = await as(admin.idUsuario)
      .post('/horarios-academicos')
      .send({
        idLaboratorio,
        idEspacio,
        idDocente: docente.idUsuario,
        idPeriodo,
        grupoAsignatura: 'G1',
        codigo: `E2E-${sufijo}`,
        diaSemana: 'lunes',
        horaInicio: '07:00',
        horaFin: '08:00',
      })
      .expect(201);

    idHorario = res.body.idHorario;
    expect(idHorario).toBeDefined();
  });

  it('estudiante crea una solicitud de reserva (queda pendiente del docente)', async () => {
    const fechaPractica = new Date();
    fechaPractica.setDate(fechaPractica.getDate() + 5); // >= antelación mínima (3 días)

    const res = await as(estudiante.idUsuario)
      .post('/solicitudes')
      .send({
        idDocenteEncargado: docente.idUsuario,
        idLaboratorio,
        idTipo: idTipoPracticaLibre,
        idFacultad,
        idPeriodo,
        fechaPractica: isoDate(fechaPractica),
        horaInicio: '10:00',
        horaFin: '11:00',
        nombrePractica: `Práctica E2E ${sufijo}`,
        numPersonas: 5,
      })
      .expect(201);

    idSolicitud = res.body.idSolicitud;
    expect(idSolicitud).toBeDefined();
    expect(res.body.estado).toBe('pendiente_docente');
  });

  it('docente encargado firma (avanza a pendiente del laboratorista)', async () => {
    const res = await as(docente.idUsuario)
      .post(`/solicitudes/${idSolicitud}/firmar`)
      .send({ observacion: 'Aprobado por el docente (e2e)' })
      .expect(201);

    expect(res.body.estado).toBe('pendiente_laboratorista');
  });

  it('laboratorista firma (la solicitud queda aprobada)', async () => {
    const res = await as(laboratorista.idUsuario)
      .post(`/solicitudes/${idSolicitud}/firmar`)
      .send({})
      .expect(201);

    expect(res.body.estado).toBe('aprobada');
  });

  it('laboratorista registra el uso real en bitácora, enlazado a la solicitud', async () => {
    const fechaPractica = new Date();
    fechaPractica.setDate(fechaPractica.getDate() + 5);

    const res = await as(laboratorista.idUsuario)
      .post('/bitacora')
      .send({
        idSolicitud,
        idLaboratorio,
        idTipo: idTipoPracticaLibre,
        fecha: isoDate(fechaPractica),
        horaInicioReal: '10:05',
        horaFinReal: '10:55',
        numAsistentes: 5,
        novedad: 'Ninguno',
        observaciones: 'Sesión sin novedad (e2e)',
      })
      .expect(201);

    idRegistro = res.body.idRegistro;
    expect(idRegistro).toBeDefined();
  });

  it('la solicitud queda "realizada" al registrarse el uso en bitácora', async () => {
    const res = await as(estudiante.idUsuario)
      .get(`/solicitudes/${idSolicitud}`)
      .expect(200);

    expect(res.body.estado).toBe('realizada');
  });

  it('el solicitante puede archivar la solicitud ya realizada', async () => {
    const res = await as(estudiante.idUsuario)
      .patch(`/solicitudes/${idSolicitud}/archivar`)
      .expect(200);

    expect(res.body.archivada).toBe(true);
  });
});
