import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('SIGELAB API')
    .setDescription(
      'Plataforma de agendamiento y reservación de laboratorios de la Universidad Santo Tomás. ' +
        'La autenticación usa una cookie httpOnly llamada "access_token" (se obtiene en POST /auth/login).',
    )
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .addTag(
      'auth',
      'Registro, login, verificación de correo y recuperación de contraseña',
    )
    .addTag('usuarios', 'Gestión de usuarios (requiere rol admin)')
    .addTag('roles', 'Gestión de roles (requiere rol admin)')
    .addTag(
      'Divisiones',
      'Catálogo de divisiones académicas (lectura para cualquier autenticado, escritura solo admin)',
    )
    .addTag(
      'Facultades',
      'Catálogo de facultades, agrupadas por división (lectura para cualquier autenticado, escritura solo admin)',
    )
    .addTag(
      'Espacios académicos',
      'Catálogo plano de espacios/materias, sin relación con facultad (lectura para cualquier autenticado, escritura solo admin)',
    )
    .addTag(
      'Tipos de reserva',
      'Catálogo de tipos de reserva y sus flags de negocio (lectura para cualquier autenticado, escritura solo admin)',
    )
    .addTag(
      'Periodos académicos',
      'Catálogo de periodos académicos (lectura para cualquier autenticado, escritura solo admin)',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
