import { Module } from '@nestjs/common';
import { LaboratoriosModule } from 'src/laboratorios/laboratorios.module';
import { EquiposLaboratorioController } from './equipos-laboratorio.controller';
import { EquiposLaboratorioService } from './equipos-laboratorio.service';

@Module({
  imports: [LaboratoriosModule],
  controllers: [EquiposLaboratorioController],
  providers: [EquiposLaboratorioService],
  exports: [EquiposLaboratorioService],
})
export class EquiposLaboratorioModule {}
