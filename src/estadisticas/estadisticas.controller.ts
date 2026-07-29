import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/auth/jwt/roles.decorator';
import { EstadisticasService } from './estadisticas.service';

@ApiTags('Estadísticas')
@ApiBearerAuth()
@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticasService: EstadisticasService) {}

  @Get()
  @Roles('admin', 'laboratorista')
  @ApiQuery({
    name: 'idPeriodo',
    required: false,
    type: Number,
    description: 'Si se omite, agrega sobre todos los periodos',
  })
  @ApiOperation({
    summary:
      'Resumen agregado del sistema: KPIs, solicitudes por estado/tipo/facultad/laboratorio y uso real de bitácora',
  })
  @ApiResponse({ status: 200, description: 'Resumen de estadísticas' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  obtener(@Query('idPeriodo') idPeriodo?: string) {
    return this.estadisticasService.obtener({
      idPeriodo: idPeriodo ? Number(idPeriodo) : undefined,
    });
  }
}
