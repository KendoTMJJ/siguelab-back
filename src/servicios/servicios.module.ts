import { Module } from '@nestjs/common';
import { LaboratoriosModule } from 'src/laboratorios/laboratorios.module';
import { ServiciosController } from './servicios.controller';
import { ServiciosService } from './servicios.service';

@Module({
  imports: [LaboratoriosModule],
  controllers: [ServiciosController],
  providers: [ServiciosService],
  exports: [ServiciosService],
})
export class ServiciosModule {}
