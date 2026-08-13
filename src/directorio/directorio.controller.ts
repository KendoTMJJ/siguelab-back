import { Body, Controller, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DirectorioService } from './directorio.service';
import { ActualizarDirectorioDto } from './dto/actualizar-directorio.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/decorators/current-user.decorator';

/**
 * Sincroniza cargo/facultad del usuario autenticado. El frontend es quien
 * los trae de Microsoft Graph (con su propio token, scope User.Read); este
 * endpoint solo persiste — ver DirectorioService para el porqué del límite.
 */
@ApiTags('directorio')
@ApiBearerAuth()
@Controller('directorio')
export class DirectorioController {
  constructor(private readonly directorioService: DirectorioService) {}

  @Patch('me')
  @ApiOperation({
    summary: 'Sincroniza cargo/facultad del usuario autenticado',
  })
  @ApiResponse({ status: 200, description: 'Info de directorio actualizada' })
  @ApiResponse({ status: 401, description: 'Token ausente o inválido' })
  actualizarPropio(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: ActualizarDirectorioDto,
  ) {
    return this.directorioService.actualizarPropio(usuario, dto);
  }
}
