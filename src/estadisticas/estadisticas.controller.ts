import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/auth/jwt/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/decorators/current-user.decorator';
import { NivelFacultad } from 'src/catalogos/entities/facultad.entity';
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
  @ApiQuery({ name: 'idDivision', required: false, type: Number })
  @ApiQuery({ name: 'idFacultad', required: false, type: Number })
  @ApiQuery({ name: 'idLaboratorio', required: false, type: Number })
  @ApiQuery({ name: 'nivel', required: false, enum: NivelFacultad })
  @ApiOperation({
    summary:
      'Resumen agregado: para docente/laboratorista, escalado a su propia actividad; el admin ve todo el sistema',
  })
  @ApiResponse({ status: 200, description: 'Resumen de estadísticas' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  obtener(
    @CurrentUser() usuario: AuthenticatedUser,
    @Query('idPeriodo') idPeriodo?: string,
    @Query('idDivision') idDivision?: string,
    @Query('idFacultad') idFacultad?: string,
    @Query('idLaboratorio') idLaboratorio?: string,
    @Query('nivel') nivel?: NivelFacultad,
  ) {
    return this.estadisticasService.obtener(
      {
        idPeriodo: idPeriodo ? Number(idPeriodo) : undefined,
        idDivision: idDivision ? Number(idDivision) : undefined,
        idFacultad: idFacultad ? Number(idFacultad) : undefined,
        idLaboratorio: idLaboratorio ? Number(idLaboratorio) : undefined,
        nivel,
      },
      usuario,
    );
  }
}
