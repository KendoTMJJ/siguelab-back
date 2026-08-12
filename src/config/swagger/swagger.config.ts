import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('SIGELAB API')
    .setDescription(
      'Plataforma de agendamiento y reservación de laboratorios de la Universidad Santo Tomás. ' +
        'La autenticación es vía Microsoft Entra ID: el frontend obtiene el access token con MSAL ' +
        'y lo envía como "Authorization: Bearer <token>" — este backend solo lo valida.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag(
      'auth',
      'Perfil del usuario autenticado (identidad resuelta vía Entra ID)',
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
    .addTag(
      'Laboratorios',
      'Espacios físicos reservables y sus asociaciones con espacios académicos y docentes encargados',
    )
    .addTag(
      'Horarios académicos',
      'Clases ya programadas que bloquean el calendario como reservas exclusivas',
    )
    .addTag(
      'Solicitudes',
      'Solicitudes de reserva y su flujo de firmas (docente → laboratorista)',
    )
    .addTag(
      'Notificaciones',
      'Notificaciones internas disparadas por el flujo de solicitudes',
    )
    .addTag(
      'Bitácora',
      'Registro de uso real de los laboratorios (historia; no se borra)',
    )
    .addTag(
      'Estadísticas',
      'Resumen agregado del sistema para admin y laboratorista (KPIs y datos para gráficos)',
    )
    .addTag(
      'Reportes',
      'Exportaciones para sistemas externos (ej. Excel de asistencias en laboratorios para Power BI)',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
