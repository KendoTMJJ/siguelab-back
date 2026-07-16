import { Module } from '@nestjs/common';
import { NotificacionesModule } from 'src/notificaciones/notificaciones.module';
import { SolicitudesController } from './solicitudes.controller';
import { DisponibilidadController } from './disponibilidad.controller';
import { SolicitudesService } from './solicitudes.service';

@Module({
  imports: [NotificacionesModule],
  controllers: [SolicitudesController, DisponibilidadController],
  providers: [SolicitudesService],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
