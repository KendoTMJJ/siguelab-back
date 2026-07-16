import { Module } from '@nestjs/common';
import { HorariosAcademicosController } from './horarios-academicos.controller';
import { HorariosAcademicosService } from './horarios-academicos.service';

@Module({
  controllers: [HorariosAcademicosController],
  providers: [HorariosAcademicosService],
  exports: [HorariosAcademicosService],
})
export class HorariosAcademicosModule {}
