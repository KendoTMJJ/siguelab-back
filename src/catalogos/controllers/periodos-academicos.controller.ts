import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PeriodosAcademicosService } from '../services/periodos-academicos.service';
import { CreatePeriodoAcademicoDto } from '../dto/periodo-academico/create-periodo-academico.dto';
import { UpdatePeriodoAcademicoDto } from '../dto/periodo-academico/update-periodo-academico.dto';
import { Roles } from 'src/auth/jwt/roles.decorator';

@ApiTags('Periodos académicos')
@ApiBearerAuth()
@Controller('periodos-academicos')
export class PeriodosAcademicosController {
  constructor(
    private readonly periodosAcademicosService: PeriodosAcademicosService,
  ) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Crear un periodo académico' })
  @ApiResponse({ status: 201, description: 'Periodo académico creado' })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos (ej. fecha_fin <= fecha_inicio)',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un periodo con ese nombre',
  })
  create(@Body() createPeriodoAcademicoDto: CreatePeriodoAcademicoDto) {
    return this.periodosAcademicosService.create(createPeriodoAcademicoDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar periodos académicos activos (fecha_inicio descendente)',
  })
  @ApiResponse({ status: 200, description: 'Listado de periodos académicos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findAll() {
    return this.periodosAcademicosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un periodo académico por id' })
  @ApiResponse({ status: 200, description: 'Periodo académico encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Periodo académico no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.periodosAcademicosService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar un periodo académico' })
  @ApiResponse({ status: 200, description: 'Periodo académico actualizado' })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos (ej. fecha_fin <= fecha_inicio)',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Periodo académico no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un periodo con ese nombre',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePeriodoAcademicoDto: UpdatePeriodoAcademicoDto,
  ) {
    return this.periodosAcademicosService.update(id, updatePeriodoAcademicoDto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Eliminar (soft delete) un periodo académico' })
  @ApiResponse({ status: 200, description: 'Periodo académico eliminado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Periodo académico no encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.periodosAcademicosService.remove(id);
  }

  @Patch(':id/restaurar')
  @Roles('admin')
  @ApiOperation({ summary: 'Restaurar un periodo académico eliminado' })
  @ApiResponse({ status: 200, description: 'Periodo académico restaurado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Periodo académico no encontrado' })
  @ApiResponse({ status: 409, description: 'No estaba eliminado' })
  restaurar(@Param('id', ParseIntPipe) id: number) {
    return this.periodosAcademicosService.restaurar(id);
  }
}
