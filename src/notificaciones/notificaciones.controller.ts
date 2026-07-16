import { Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/decorators/current-user.decorator';
import { NotificacionesService } from './notificaciones.service';

@ApiTags('Notificaciones')
@ApiBearerAuth()
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar mis notificaciones (orden descendente)' })
  @ApiResponse({ status: 200, description: 'Listado de notificaciones' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findMias(@CurrentUser() usuario: AuthenticatedUser) {
    return this.notificacionesService.findMias(usuario.id);
  }

  @Patch(':id/leida')
  @ApiOperation({ summary: 'Marcar una notificación propia como leída' })
  @ApiResponse({ status: 200, description: 'Notificación marcada como leída' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No eres el destinatario' })
  @ApiResponse({ status: 404, description: 'Notificación no encontrada' })
  marcarLeida(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.notificacionesService.marcarLeida(id, usuario.id);
  }
}
