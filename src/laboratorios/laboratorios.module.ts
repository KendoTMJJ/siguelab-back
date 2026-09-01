import { Module } from '@nestjs/common';
import { LaboratoriosController } from './controllers/laboratorios.controller';
import { EspaciosLaboratorioController } from './controllers/espacios-laboratorio.controller';
import { LaboratoriosService } from './services/laboratorios.service';
import { EspaciosLaboratorioService } from './services/espacios-laboratorio.service';
import { DocentesLaboratorioService } from './services/docentes-laboratorio.service';
import { LaboratoristasLaboratorioService } from './services/laboratoristas-laboratorio.service';

@Module({
  controllers: [LaboratoriosController, EspaciosLaboratorioController],
  providers: [
    LaboratoriosService,
    EspaciosLaboratorioService,
    DocentesLaboratorioService,
    LaboratoristasLaboratorioService,
  ],
  exports: [
    LaboratoriosService,
    EspaciosLaboratorioService,
    DocentesLaboratorioService,
    LaboratoristasLaboratorioService,
  ],
})
export class LaboratoriosModule {}
