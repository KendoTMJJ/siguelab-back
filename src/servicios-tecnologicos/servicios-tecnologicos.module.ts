import { Module } from '@nestjs/common';
import { EquiposLaboratorioModule } from 'src/equipos-laboratorio/equipos-laboratorio.module';
import { LaboratoriosModule } from 'src/laboratorios/laboratorios.module';
import { ServiciosModule } from 'src/servicios/servicios.module';
import { NotificacionesModule } from 'src/notificaciones/notificaciones.module';
import { ServiciosTecnologicosController } from './servicios-tecnologicos.controller';
import { ServiciosTecnologicosService } from './servicios-tecnologicos.service';

@Module({
  imports: [
    EquiposLaboratorioModule,
    LaboratoriosModule,
    ServiciosModule,
    NotificacionesModule,
  ],
  controllers: [ServiciosTecnologicosController],
  providers: [ServiciosTecnologicosService],
  exports: [ServiciosTecnologicosService],
})
export class ServiciosTecnologicosModule {}
