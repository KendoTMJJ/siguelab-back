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
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/decorators/current-user.decorator';
import { LaboratoriosService } from '../services/laboratorios.service';
import { EspaciosLaboratorioService } from '../services/espacios-laboratorio.service';
import { DocentesLaboratorioService } from '../services/docentes-laboratorio.service';
import { LaboratoristasLaboratorioService } from '../services/laboratoristas-laboratorio.service';
import { CreateLaboratorioDto } from '../dto/laboratorio/create-laboratorio.dto';
import { UpdateLaboratorioDto } from '../dto/laboratorio/update-laboratorio.dto';
import { CreateEspacioLaboratorioDto } from '../dto/espacio-laboratorio/create-espacio-laboratorio.dto';
import { CreateDocenteLaboratorioDto } from '../dto/docente-laboratorio/create-docente-laboratorio.dto';
import { CreateLaboratoristaLaboratorioDto } from '../dto/laboratorista-laboratorio/create-laboratorista-laboratorio.dto';
import { EstadoLaboratorio } from '../entities/laboratorio.entity';
import { resolvePagination } from 'src/common/pagination/pagination.util';

@ApiTags('Laboratorios')
@ApiBearerAuth()
@Controller('laboratorios')
export class LaboratoriosController {
  constructor(
    private readonly laboratoriosService: LaboratoriosService,
    private readonly espaciosLaboratorioService: EspaciosLaboratorioService,
    private readonly docentesLaboratorioService: DocentesLaboratorioService,
    private readonly laboratoristasLaboratorioService: LaboratoristasLaboratorioService,
  ) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Crear un laboratorio' })
  @ApiResponse({ status: 201, description: 'Laboratorio creado' })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos (ej. capacidad <= 0)',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un laboratorio con ese nombre',
  })
  create(@Body() createLaboratorioDto: CreateLaboratorioDto) {
    return this.laboratoriosService.create(createLaboratorioDto);
  }

  @Get()
  @ApiQuery({ name: 'estado', required: false, enum: ['activo', 'inactivo'] })
  @ApiQuery({ name: 'incluirInactivos', required: false, type: Boolean })
  @ApiQuery({
    name: 'buscar',
    required: false,
    description: 'Filtra por nombre (contiene, sin distinguir mayúsculas)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description:
      'Si se envía (junto con o sin `limit`), la respuesta es { data, meta }. Si se omiten ambos, devuelve el arreglo completo (lo usan los <select> de otras pantallas).',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({
    summary:
      'Listar laboratorios (por defecto solo activos; filtros solo surten efecto para admin)',
  })
  @ApiResponse({ status: 200, description: 'Listado de laboratorios' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findAll(
    @CurrentUser() usuario: AuthenticatedUser,
    @Query('estado') estado?: EstadoLaboratorio,
    @Query('incluirInactivos') incluirInactivos?: string,
    @Query('buscar') buscar?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filtros = {
      estado,
      incluirInactivos: incluirInactivos === 'true',
      buscar,
    };
    const esAdmin = usuario.rol === 'admin';
    const pagination =
      page || limit ? resolvePagination(page, limit) : undefined;
    return pagination
      ? this.laboratoriosService.findAll(filtros, esAdmin, pagination)
      : this.laboratoriosService.findAll(filtros, esAdmin);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un laboratorio por id' })
  @ApiResponse({ status: 200, description: 'Laboratorio encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Laboratorio no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.laboratoriosService.findOne(id);
  }

  @Get(':id/espacios-academicos')
  @ApiOperation({
    summary:
      'Vista inversa: espacios académicos asociados a un laboratorio (cualquier rol autenticado — es el filtro que usa el formulario de solicitudes)',
  })
  @ApiResponse({ status: 200, description: 'Listado de espacios académicos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Laboratorio no encontrado' })
  espaciosAcademicos(@Param('id', ParseIntPipe) id: number) {
    return this.espaciosLaboratorioService.espaciosDeLaboratorio(id);
  }

  @Post(':id/espacios-academicos')
  @Roles('admin')
  @ApiOperation({ summary: 'Asociar un espacio académico a un laboratorio' })
  @ApiResponse({ status: 201, description: 'Asociación creada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({
    status: 404,
    description: 'Laboratorio o espacio no encontrado',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya asociados, o laboratorio inactivo',
  })
  asociarEspacio(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateEspacioLaboratorioDto,
  ) {
    return this.espaciosLaboratorioService.asociar(id, dto.idEspacio);
  }

  @Delete(':id/espacios-academicos/:idEspacio')
  @Roles('admin')
  @ApiOperation({
    summary: 'Desasociar un espacio académico de un laboratorio',
  })
  @ApiResponse({ status: 200, description: 'Asociación eliminada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Asociación no encontrada' })
  desasociarEspacio(
    @Param('id', ParseIntPipe) id: number,
    @Param('idEspacio', ParseIntPipe) idEspacio: number,
  ) {
    return this.espaciosLaboratorioService.desasociar(id, idEspacio);
  }

  @Get(':id/docentes-encargados')
  @ApiOperation({
    summary: 'Listar docentes encargados seleccionables de un laboratorio',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de docentes (id, nombre, correo)',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Laboratorio no encontrado' })
  docentesEncargados(@Param('id', ParseIntPipe) id: number) {
    return this.docentesLaboratorioService.docentesDeLaboratorio(id);
  }

  @Post(':id/docentes-encargados')
  @Roles('admin')
  @ApiOperation({ summary: 'Asociar un docente encargado a un laboratorio' })
  @ApiResponse({ status: 201, description: 'Asociación creada' })
  @ApiResponse({ status: 400, description: 'El usuario no tiene rol docente' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({
    status: 404,
    description: 'Laboratorio o usuario no encontrado',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya asociado, o laboratorio inactivo',
  })
  asociarDocente(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDocenteLaboratorioDto,
  ) {
    return this.docentesLaboratorioService.asociar(id, dto.idUsuario);
  }

  @Delete(':id/docentes-encargados/:idUsuario')
  @Roles('admin')
  @ApiOperation({
    summary: 'Desasociar un docente encargado de un laboratorio',
  })
  @ApiResponse({ status: 200, description: 'Asociación eliminada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Asociación no encontrada' })
  desasociarDocente(
    @Param('id', ParseIntPipe) id: number,
    @Param('idUsuario') idUsuario: string,
  ) {
    return this.docentesLaboratorioService.desasociar(id, idUsuario);
  }

  @Get(':id/laboratoristas-encargados')
  @ApiOperation({
    summary:
      'Listar laboratoristas/analistas a cargo de un laboratorio (trazabilidad, no restringe acceso)',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de laboratoristas (id, nombre, correo)',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Laboratorio no encontrado' })
  laboratoristasEncargados(@Param('id', ParseIntPipe) id: number) {
    return this.laboratoristasLaboratorioService.laboratoristasDeLaboratorio(
      id,
    );
  }

  @Post(':id/laboratoristas-encargados')
  @Roles('admin')
  @ApiOperation({
    summary: 'Asociar un laboratorista a cargo de un laboratorio',
  })
  @ApiResponse({ status: 201, description: 'Asociación creada' })
  @ApiResponse({
    status: 400,
    description: 'El usuario no tiene rol laboratorista',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({
    status: 404,
    description: 'Laboratorio o usuario no encontrado',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya asociado, o laboratorio inactivo',
  })
  asociarLaboratorista(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateLaboratoristaLaboratorioDto,
  ) {
    return this.laboratoristasLaboratorioService.asociar(id, dto.idUsuario);
  }

  @Delete(':id/laboratoristas-encargados/:idUsuario')
  @Roles('admin')
  @ApiOperation({
    summary: 'Desasociar un laboratorista a cargo de un laboratorio',
  })
  @ApiResponse({ status: 200, description: 'Asociación eliminada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Asociación no encontrada' })
  desasociarLaboratorista(
    @Param('id', ParseIntPipe) id: number,
    @Param('idUsuario') idUsuario: string,
  ) {
    return this.laboratoristasLaboratorioService.desasociar(id, idUsuario);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar un laboratorio' })
  @ApiResponse({ status: 200, description: 'Laboratorio actualizado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Laboratorio no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un laboratorio con ese nombre',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLaboratorioDto: UpdateLaboratorioDto,
  ) {
    return this.laboratoriosService.update(id, updateLaboratorioDto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Eliminar (soft delete) un laboratorio' })
  @ApiResponse({ status: 200, description: 'Laboratorio eliminado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Laboratorio no encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.laboratoriosService.remove(id);
  }

  @Patch(':id/restaurar')
  @Roles('admin')
  @ApiOperation({ summary: 'Restaurar un laboratorio eliminado' })
  @ApiResponse({
    status: 200,
    description: 'Laboratorio restaurado (con sus asociaciones intactas)',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Laboratorio no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'No estaba eliminado, o ya existe uno activo con ese nombre',
  })
  restaurar(@Param('id', ParseIntPipe) id: number) {
    return this.laboratoriosService.restaurar(id);
  }
}
