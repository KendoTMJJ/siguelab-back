import { Module } from '@nestjs/common';
import { LaboratoriosModule } from 'src/laboratorios/laboratorios.module';
import { EquiposLaboratorioModule } from 'src/equipos-laboratorio/equipos-laboratorio.module';
import { NotificacionesModule } from 'src/notificaciones/notificaciones.module';
import { EventosLaboratorioController } from './eventos-laboratorio.controller';
import { EventosLaboratorioService } from './eventos-laboratorio.service';

@Module({
  imports: [LaboratoriosModule, EquiposLaboratorioModule, NotificacionesModule],
  controllers: [EventosLaboratorioController],
  providers: [EventosLaboratorioService],
  exports: [EventosLaboratorioService],
})
export class EventosLaboratorioModule {}
