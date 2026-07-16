import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SolicitudesService } from './solicitudes.service';

/**
 * Vive en el módulo solicitudes (no en laboratorios) porque necesita cruzar
 * horarios académicos + solicitudes aprobadas, dominio propio de este módulo.
 */
@ApiTags('Laboratorios')
@ApiBearerAuth()
@Controller('laboratorios')
export class DisponibilidadController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Get(':id/disponibilidad')
  @ApiQuery({ name: 'fecha', required: true, example: '2026-08-10' })
  @ApiOperation({
    summary:
      'Bloques ocupados de un laboratorio en una fecha (para pintar el calendario)',
  })
  @ApiResponse({ status: 200, description: 'Listado de bloques ocupados' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Laboratorio no encontrado' })
  disponibilidad(
    @Param('id', ParseIntPipe) id: number,
    @Query('fecha') fecha: string,
  ) {
    return this.solicitudesService.disponibilidad(id, fecha);
  }
}
