import { Module } from '@nestjs/common';
import { DivisionesController } from './controllers/divisiones.controller';
import { DivisionesService } from './services/divisiones.service';
import { FacultadesController } from './controllers/facultades.controller';
import { FacultadesService } from './services/facultades.service';
import { EspaciosAcademicosController } from './controllers/espacios-academicos.controller';
import { EspaciosAcademicosService } from './services/espacios-academicos.service';
import { TiposReservaController } from './controllers/tipos-reserva.controller';
import { TiposReservaService } from './services/tipos-reserva.service';
import { PeriodosAcademicosController } from './controllers/periodos-academicos.controller';
import { PeriodosAcademicosService } from './services/periodos-academicos.service';

@Module({
  controllers: [
    DivisionesController,
    FacultadesController,
    EspaciosAcademicosController,
    TiposReservaController,
    PeriodosAcademicosController,
  ],
  providers: [
    DivisionesService,
    FacultadesService,
    EspaciosAcademicosService,
    TiposReservaService,
    PeriodosAcademicosService,
  ],
})
export class CatalogosModule {}
