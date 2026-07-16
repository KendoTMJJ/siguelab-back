import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EspaciosLaboratorioService } from '../services/espacios-laboratorio.service';

/**
 * Vive en el módulo laboratorios (no en catalogos) aunque la URL empiece con
 * /espacios-academicos: es el eslabón de filtrado que consume el formulario
 * de solicitudes (elegir materia → ver solo sus laboratorios asociados).
 */
@ApiTags('Espacios académicos')
@ApiBearerAuth()
@Controller('espacios-academicos')
export class EspaciosLaboratorioController {
  constructor(
    private readonly espaciosLaboratorioService: EspaciosLaboratorioService,
  ) {}

  @Get(':id/laboratorios')
  @ApiOperation({
    summary:
      'Listar laboratorios asociados a un espacio académico (activos y no eliminados)',
  })
  @ApiResponse({ status: 200, description: 'Listado de laboratorios' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Espacio académico no encontrado' })
  laboratorios(@Param('id', ParseIntPipe) id: number) {
    return this.espaciosLaboratorioService.laboratoriosDeEspacio(id);
  }
}
