import { Module } from '@nestjs/common';
import { UsuariosModule } from 'src/usuarios/usuarios.module';
import { DirectorioController } from './directorio.controller';
import { DirectorioService } from './directorio.service';

@Module({
  imports: [UsuariosModule],
  controllers: [DirectorioController],
  providers: [DirectorioService],
})
export class DirectorioModule {}
