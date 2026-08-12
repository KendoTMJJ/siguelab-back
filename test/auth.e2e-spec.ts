import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

/**
 * Con Entra ID como única fuente de identidad, un login real solo se puede
 * probar con un token válido emitido por Microsoft (no se puede firmar uno
 * falso: JwtStrategy valida la firma RS256 contra las llaves públicas de
 * Entra vía JWKS). Ese flujo completo se valida manualmente (Swagger/
 * Postman con un token real, como ya se hizo con el prototipo). Este e2e
 * solo cubre lo verificable sin un token real: que las rutas protegidas
 * rechazan solicitudes sin token o con uno inválido/mal formado.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

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
  });

  afterAll(async () => {
    await app.close();
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  describe('Rutas protegidas sin token', () => {
    it('GET /auth/me sin token responde 401', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('GET /usuarios sin token responde 401', async () => {
      await request(app.getHttpServer()).get('/usuarios').expect(401);
    });
  });

  describe('Token mal formado', () => {
    it('GET /auth/me con un token que no es un JWT válido responde 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer no-soy-un-jwt')
        .expect(401);
    });

    it('GET /auth/me con un JWT bien formado pero no firmado por Entra responde 401', async () => {
      // header.payload.signature con algoritmo/firma arbitrarios: la
      // estrategia solo acepta RS256 firmado por las llaves JWKS de Entra.
      const tokenFalso =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvaWQiOiJ4In0.firma-invalida';

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${tokenFalso}`)
        .expect(401);
    });
  });
});
