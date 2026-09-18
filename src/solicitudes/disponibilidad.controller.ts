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

  @Get(':id/eventos-especiales-mes')
  @ApiQuery({ name: 'year', required: true, example: 2026 })
  @ApiQuery({ name: 'month', required: true, example: 8, description: '1-12' })
  @ApiOperation({
    summary:
      'Fechas de ese mes con una reserva especial aprobada en el laboratorio (para marcarlas en la vista de mes del calendario)',
  })
  @ApiResponse({ status: 200, description: "Listado de 'YYYY-MM-DD'" })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Laboratorio no encontrado' })
  eventosEspecialesDelMes(
    @Param('id', ParseIntPipe) id: number,
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.solicitudesService.fechasEventoEspecialDelMes(id, year, month);
  }
}
