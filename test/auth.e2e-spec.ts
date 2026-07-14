import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { UsuariosService } from '../src/usuarios/usuarios.service';
import { TokenAuthService } from '../src/auth/token-auth.service';
import { TipoToken } from '../src/auth/entities/token-auth.entity';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let usuariosService: UsuariosService;
  let tokenAuthService: TokenAuthService;

  const correoEstudiante = `e2e-${Date.now()}@usantoto.edu.co`;
  const contrasena = 'ClaveInicial123';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    dataSource = app.get(DataSource);
    usuariosService = app.get(UsuariosService);
    tokenAuthService = app.get(TokenAuthService);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM usuario WHERE correo LIKE ?', [
      'e2e-%',
    ]);
    await app.close();
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('POST /auth/registro', () => {
    it('rechaza correos fuera del dominio institucional', async () => {
      await request(app.getHttpServer())
        .post('/auth/registro')
        .send({
          nombre: 'Externo',
          correo: 'externo@gmail.com',
          contrasena,
        })
        .expect(400);
    });

    it('registra un usuario con dominio institucional válido', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/registro')
        .send({
          nombre: 'Estudiante E2E',
          correo: correoEstudiante,
          contrasena,
        })
        .expect(201);

      expect(res.body.mensaje).toContain('Registro exitoso');
    });

    it('rechaza un segundo registro con el mismo correo', async () => {
      await request(app.getHttpServer())
        .post('/auth/registro')
        .send({
          nombre: 'Estudiante E2E',
          correo: correoEstudiante,
          contrasena,
        })
        .expect(409);
    });
  });

  describe('Rutas protegidas sin sesión', () => {
    it('GET /usuarios sin cookie responde 401', async () => {
      await request(app.getHttpServer()).get('/usuarios').expect(401);
    });

    it('GET /auth/me sin cookie responde 401', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });
  });

  describe('Login antes de verificar el correo', () => {
    it('rechaza el login con 403', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ correo: correoEstudiante, contrasena })
        .expect(403);
    });
  });

  describe('Verificación de correo y login', () => {
    let cookie: string[];

    it('GET /auth/verificar/:token con token inválido responde 400', async () => {
      await request(app.getHttpServer())
        .get('/auth/verificar/token-que-no-existe')
        .expect(400);
    });

    it('verifica el correo con un token válido', async () => {
      const usuario = await usuariosService.findByCorreo(correoEstudiante);
      const token = await tokenAuthService.generar(
        usuario!,
        TipoToken.VERIFICACION,
        24 * 60,
      );

      await request(app.getHttpServer())
        .get(`/auth/verificar/${token}`)
        .expect(200);
    });

    it('permite el login luego de verificar, y setea la cookie httpOnly', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ correo: correoEstudiante, contrasena })
        .expect(200);

      expect(res.body.usuario.correo).toBe(correoEstudiante);
      expect(res.headers['set-cookie']).toBeDefined();
      cookie = res.headers['set-cookie'] as unknown as string[];
      expect(cookie[0]).toContain('access_token=');
      expect(cookie[0]).toContain('HttpOnly');
    });

    it('GET /auth/me con la cookie retorna el usuario autenticado', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.correo).toBe(correoEstudiante);
      expect(res.body.rol).toBe('estudiante');
    });

    it('GET /usuarios con un estudiante autenticado responde 403 (requiere admin)', async () => {
      await request(app.getHttpServer())
        .get('/usuarios')
        .set('Cookie', cookie)
        .expect(403);
    });

    it('POST /auth/logout limpia la cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.headers['set-cookie'][0]).toContain('access_token=;');
    });
  });
});
