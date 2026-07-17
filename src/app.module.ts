import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConectionModule } from './config/conection/conection.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { RolesModule } from './roles/roles.module';
import { AuthModule } from './auth/auth.module';
import { CatalogosModule } from './catalogos/catalogos.module';
import { LaboratoriosModule } from './laboratorios/laboratorios.module';
import { HorariosAcademicosModule } from './horarios-academicos/horarios-academicos.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';
import { BitacoraModule } from './bitacora/bitacora.module';
import { JwtGuard } from './auth/jwt/jwt.guard';
import { RolesGuard } from './auth/jwt/roles.guard';
import { ThrottlerCustomGuard } from './auth/jwt/throttler-custom.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ConectionModule,
    ThrottlerModule.forRoot({
      throttlers: [
        // { name: 'default', ttl: minutes(1), limit: 30 },
        // { name: 'login', ttl: minutes(60), limit: 5 },
        // { name: 'olvide-password', ttl: minutes(60), limit: 5 },
        // { name: 'reenviar-verificacion', ttl: minutes(60), limit: 5 },
      ],
    }),
    UsuariosModule,
    RolesModule,
    AuthModule,
    CatalogosModule,
    LaboratoriosModule,
    HorariosAcademicosModule,
    NotificacionesModule,
    SolicitudesModule,
    BitacoraModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: ThrottlerCustomGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
