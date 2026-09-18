import { Module } from '@nestjs/common';
import { NotificacionesModule } from 'src/notificaciones/notificaciones.module';
import { SolicitudesController } from './solicitudes.controller';
import { DisponibilidadController } from './disponibilidad.controller';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudesScheduler } from './solicitudes.scheduler';

@Module({
  imports: [NotificacionesModule],
  controllers: [SolicitudesController, DisponibilidadController],
  providers: [SolicitudesService, SolicitudesScheduler],
  exports: [SolicitudesService],
})
export class SolicitudesModule {}
