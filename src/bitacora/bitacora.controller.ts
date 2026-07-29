import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
import { BitacoraService } from './bitacora.service';
import { CreateRegistroUsoDto } from './dto/create-registro-uso.dto';
import { UpdateRegistroUsoDto } from './dto/update-registro-uso.dto';

@ApiTags('Bitácora')
@ApiBearerAuth()
@Controller('bitacora')
export class BitacoraController {
  constructor(private readonly bitacoraService: BitacoraService) {}

  @Post()
  @Roles('laboratorista')
  @ApiOperation({ summary: 'Registrar un uso real del laboratorio' })
  @ApiResponse({ status: 201, description: 'Registro creado' })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos (ej. hora_fin_real <= hora_inicio_real, solicitud no aprobada o de otro laboratorio)',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({
    status: 404,
    description: 'Laboratorio, tipo de reserva o solicitud no encontrados',
  })
  create(
    @Body() createRegistroUsoDto: CreateRegistroUsoDto,
    @CurrentUser() laboratorista: AuthenticatedUser,
  ) {
    return this.bitacoraService.create(createRegistroUsoDto, laboratorista);
  }

  @Get()
  @Roles('laboratorista', 'admin')
  @ApiQuery({ name: 'idLaboratorio', required: false, type: Number })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String })
  @ApiQuery({ name: 'idPeriodo', required: false, type: Number })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description:
      'Si se omite (junto con pageSize), devuelve todas las filas sin paginar.',
  })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiOperation({ summary: 'Listar la bitácora de uso' })
  @ApiResponse({
    status: 200,
    description: '{ items, total, page, pageSize }',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  findAll(
    @Query('idLaboratorio') idLaboratorio?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('idPeriodo') idPeriodo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.bitacoraService.findAll({
      idLaboratorio: idLaboratorio ? Number(idLaboratorio) : undefined,
      fechaDesde,
      fechaHasta,
      idPeriodo: idPeriodo ? Number(idPeriodo) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  @Roles('laboratorista', 'admin')
  @ApiOperation({ summary: 'Ver el detalle de un registro de bitácora' })
  @ApiResponse({ status: 200, description: 'Registro encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Registro no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bitacoraService.findOne(id);
  }

  @Patch(':id')
  @Roles('laboratorista')
  @ApiOperation({
    summary:
      'Corregir un registro de bitácora ya creado (todos los campos, edición parcial)',
  })
  @ApiResponse({ status: 200, description: 'Registro actualizado' })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos (ej. hora_fin_real <= hora_inicio_real, o laboratorio distinto al de la solicitud enlazada)',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({
    status: 404,
    description: 'Registro, laboratorio o tipo de reserva no encontrados',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRegistroUsoDto: UpdateRegistroUsoDto,
  ) {
    return this.bitacoraService.update(id, updateRegistroUsoDto);
  }
}
