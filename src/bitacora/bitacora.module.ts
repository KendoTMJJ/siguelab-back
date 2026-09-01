import { Module } from '@nestjs/common';
import { SolicitudesModule } from 'src/solicitudes/solicitudes.module';
import { BitacoraController } from './bitacora.controller';
import { BitacoraService } from './bitacora.service';

@Module({
  imports: [SolicitudesModule],
  controllers: [BitacoraController],
  providers: [BitacoraService],
})
export class BitacoraModule {}
