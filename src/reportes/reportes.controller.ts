import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from 'src/auth/jwt/roles.decorator';
import { ReportesService } from './reportes.service';
import { ExportarAsistenciasQueryDto } from './dto/exportar-asistencias-query.dto';

@ApiTags('Reportes')
@ApiBearerAuth()
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('asistencias-laboratorios/exportar')
  @Roles('admin', 'laboratorista')
  @ApiOperation({
    summary:
      'Exporta el Excel de asistencias en laboratorios (reemplaza el archivo manual que alimenta Power BI vía Power Query)',
  })
  @ApiResponse({ status: 200, description: 'Archivo .xlsx' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({
    status: 404,
    description: 'No hay periodos académicos configurados',
  })
  async exportar(
    @Query() filtros: ExportarAsistenciasQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, nombreArchivo } =
      await this.reportesService.exportarExcel(filtros);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('asistencias-laboratorios/exportar/validar')
  @Roles('admin', 'laboratorista')
  @ApiOperation({
    summary:
      'Reporte de inconsistencias del export de asistencias, sin generar el archivo (laboratorios sin hoja, valores fuera de las listas cerradas, bitácora sin solicitud asociada)',
  })
  @ApiResponse({ status: 200, description: 'Reporte de validación' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  validar(@Query() filtros: ExportarAsistenciasQueryDto) {
    return this.reportesService.validar(filtros);
  }
}
