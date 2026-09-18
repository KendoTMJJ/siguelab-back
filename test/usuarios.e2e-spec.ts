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

/**
 * Nombre editable por el propio usuario (PATCH /usuarios/me, cualquier rol)
 * y por el admin (PATCH /usuarios/:id, junto con el rol) — ver
 * UsuariosController/UsuariosService. El caso de mayor riesgo real acá no es
 * la lógica (ya cubierta en usuarios.service.spec.ts) sino el ENRUTAMIENTO:
 * '/usuarios/me' tiene que resolver a su propio handler, no caer en
 * '/usuarios/:id' con "me" como id — eso solo se puede confirmar con HTTP
 * real, de ahí este e2e (mismo patrón que flujo-completo-reserva.e2e-spec.ts).
 */
describe('Usuarios — nombre editable (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const sufijo = Date.now();

  let server: App;
  const as = (idUsuario: string) => ({
    patch: (url: string) =>
      request(server).patch(url).set('x-e2e-user-id', idUsuario),
  });

  let admin: Usuario;
  let estudiante: Usuario;
  let docente: Usuario;

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
    const [rolAdmin, rolEstudiante, rolDocente] = await Promise.all([
      rolRepo.findOneByOrFail({ nombre: 'admin' }),
      rolRepo.findOneByOrFail({ nombre: 'estudiante' }),
      rolRepo.findOneByOrFail({ nombre: 'docente' }),
    ]);

    [admin, estudiante, docente] = await usuarioRepo.save([
      usuarioRepo.create({
        nombre: `E2E Admin Usuarios ${sufijo}`,
        correo: `e2e-admin-usuarios-${sufijo}@test.local`,
        rol: rolAdmin,
        estado: EstadoUsuario.ACTIVO,
      }),
      usuarioRepo.create({
        nombre: `E2E Estudiante Usuarios ${sufijo}`,
        correo: `e2e-estudiante-usuarios-${sufijo}@test.local`,
        rol: rolEstudiante,
        estado: EstadoUsuario.ACTIVO,
      }),
      usuarioRepo.create({
        nombre: `E2E Docente Usuarios ${sufijo}`,
        correo: `e2e-docente-usuarios-${sufijo}@test.local`,
        rol: rolDocente,
        estado: EstadoUsuario.ACTIVO,
      }),
    ]);
  });

  afterAll(async () => {
    try {
      await dataSource
        .getRepository(Usuario)
        .delete([admin.idUsuario, estudiante.idUsuario, docente.idUsuario]);
    } finally {
      jest.restoreAllMocks();
      await app.close();
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    }
  });

  it('cualquier rol autenticado puede editar su propio nombre vía PATCH /usuarios/me', async () => {
    const res = await as(estudiante.idUsuario)
      .patch('/usuarios/me')
      .send({ nombre: `Nombre Editado ${sufijo}` })
      .expect(200);

    expect(res.body.nombre).toBe(`Nombre Editado ${sufijo}`);

    const enBd = await dataSource
      .getRepository(Usuario)
      .findOneByOrFail({ idUsuario: estudiante.idUsuario });
    expect(enBd.nombre).toBe(`Nombre Editado ${sufijo}`);
  });

  it('PATCH /usuarios/me rechaza un nombre vacío', async () => {
    await as(estudiante.idUsuario)
      .patch('/usuarios/me')
      .send({ nombre: '' })
      .expect(400);
  });

  it('PATCH /usuarios/me ignora un idRol en el body — no se puede autoescalar el rol por ahí', async () => {
    await as(estudiante.idUsuario)
      .patch('/usuarios/me')
      .send({ nombre: 'Intento de escalar', idRol: admin.rol.idRol })
      .expect(200);

    const enBd = await dataSource.getRepository(Usuario).findOne({
      where: { idUsuario: estudiante.idUsuario },
      relations: { rol: true },
    });
    expect(enBd!.rol.nombre).toBe('estudiante');
    expect(enBd!.nombre).toBe('Intento de escalar');
  });

  it('el admin puede editar nombre y rol de otro usuario vía PATCH /usuarios/:id', async () => {
    const rolLaboratorista = await dataSource
      .getRepository(Rol)
      .findOneByOrFail({ nombre: 'laboratorista' });

    const res = await as(admin.idUsuario)
      .patch(`/usuarios/${docente.idUsuario}`)
      .send({
        nombre: `Docente Renombrado ${sufijo}`,
        idRol: rolLaboratorista.idRol,
      })
      .expect(200);

    expect(res.body.nombre).toBe(`Docente Renombrado ${sufijo}`);
    expect(res.body.rol.idRol).toBe(rolLaboratorista.idRol);
  });

  it('un rol distinto de admin no puede editar a otro usuario vía PATCH /usuarios/:id', async () => {
    await as(estudiante.idUsuario)
      .patch(`/usuarios/${docente.idUsuario}`)
      .send({ nombre: 'No debería poder' })
      .expect(403);
  });
});
