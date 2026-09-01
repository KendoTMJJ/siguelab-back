import {
  Body,
  Controller,
  Delete,
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
import { ServiciosService } from './servicios.service';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { UpdateServicioDto } from './dto/update-servicio.dto';

@ApiTags('Servicios (catálogo)')
@ApiBearerAuth()
@Controller('servicios')
export class ServiciosController {
  constructor(private readonly serviciosService: ServiciosService) {}

  @Post()
  @Roles('admin', 'laboratorista')
  @ApiOperation({ summary: 'Crear un servicio del catálogo de un laboratorio' })
  @ApiResponse({ status: 201, description: 'Servicio creado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Laboratorio no encontrado' })
  create(@Body() dto: CreateServicioDto) {
    return this.serviciosService.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'idLaboratorio', required: false, type: Number })
  @ApiQuery({ name: 'incluirInactivos', required: false, type: Boolean })
  @ApiOperation({
    summary:
      'Listar servicios del catálogo (abierto a cualquier rol autenticado)',
  })
  @ApiResponse({ status: 200, description: 'Listado de servicios' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findAll(
    @Query('idLaboratorio') idLaboratorio?: string,
    @Query('incluirInactivos') incluirInactivos?: string,
  ) {
    return this.serviciosService.findAll({
      idLaboratorio: idLaboratorio ? Number(idLaboratorio) : undefined,
      incluirInactivos: incluirInactivos === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un servicio del catálogo' })
  @ApiResponse({ status: 200, description: 'Servicio encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.serviciosService.findOne(id);
  }

  @Get(':id/equipos')
  @ApiOperation({
    summary: 'Listar los equipos que ofrecen este servicio (puede estar vacío)',
  })
  @ApiResponse({ status: 200, description: 'Equipos del servicio' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  equiposDe(@Param('id', ParseIntPipe) id: number) {
    return this.serviciosService.equiposDe(id);
  }

  @Patch(':id')
  @Roles('admin', 'laboratorista')
  @ApiOperation({ summary: 'Actualizar un servicio del catálogo' })
  @ApiResponse({ status: 200, description: 'Servicio actualizado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServicioDto,
  ) {
    return this.serviciosService.update(id, dto);
  }

  @Patch(':id/desactivar')
  @Roles('admin', 'laboratorista')
  @ApiOperation({
    summary:
      'Desactivar el servicio (no se borra, deja de ofrecerse en nuevas solicitudes)',
  })
  @ApiResponse({ status: 200, description: 'Servicio desactivado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.serviciosService.remove(id);
  }

  @Delete(':id')
  @Roles('admin', 'laboratorista')
  @ApiOperation({
    summary:
      'Eliminar (soft delete) un servicio del catálogo — bloqueado si tiene equipos asociados',
  })
  @ApiResponse({ status: 200, description: 'Servicio eliminado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Tiene equipos asociados — reasígnalos o elimínalos primero',
  })
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.serviciosService.eliminar(id);
  }

  @Patch(':id/restaurar')
  @Roles('admin', 'laboratorista')
  @ApiOperation({ summary: 'Restaurar un servicio eliminado' })
  @ApiResponse({ status: 200, description: 'Servicio restaurado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @ApiResponse({ status: 409, description: 'El servicio no está eliminado' })
  restaurar(@Param('id', ParseIntPipe) id: number) {
    return this.serviciosService.restaurar(id);
  }
}
