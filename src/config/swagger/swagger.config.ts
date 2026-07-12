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
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
