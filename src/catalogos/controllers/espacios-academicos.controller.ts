import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { EspaciosAcademicosService } from '../services/espacios-academicos.service';
import { CreateEspacioAcademicoDto } from '../dto/espacio-academico/create-espacio-academico.dto';
import { UpdateEspacioAcademicoDto } from '../dto/espacio-academico/update-espacio-academico.dto';
import { Roles } from 'src/auth/jwt/roles.decorator';

@ApiTags('Espacios académicos')
@ApiBearerAuth()
@Controller('espacios-academicos')
export class EspaciosAcademicosController {
  constructor(
    private readonly espaciosAcademicosService: EspaciosAcademicosService,
  ) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Crear un espacio académico' })
  @ApiResponse({ status: 201, description: 'Espacio académico creado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un espacio con ese nombre',
  })
  create(@Body() createEspacioAcademicoDto: CreateEspacioAcademicoDto) {
    return this.espaciosAcademicosService.create(createEspacioAcademicoDto);
  }

  @Get()
  @ApiQuery({
    name: 'buscar',
    required: false,
    description: 'Filtra por nombre (contiene, sin distinguir mayúsculas)',
  })
  @ApiOperation({ summary: 'Listar espacios académicos activos' })
  @ApiResponse({ status: 200, description: 'Listado de espacios académicos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findAll(@Query('buscar') buscar?: string) {
    return this.espaciosAcademicosService.findAll(buscar);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un espacio académico por id' })
  @ApiResponse({ status: 200, description: 'Espacio académico encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Espacio académico no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.espaciosAcademicosService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar un espacio académico' })
  @ApiResponse({ status: 200, description: 'Espacio académico actualizado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Espacio académico no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un espacio con ese nombre',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEspacioAcademicoDto: UpdateEspacioAcademicoDto,
  ) {
    return this.espaciosAcademicosService.update(id, updateEspacioAcademicoDto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Eliminar (soft delete) un espacio académico' })
  @ApiResponse({ status: 200, description: 'Espacio académico eliminado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Espacio académico no encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.espaciosAcademicosService.remove(id);
  }

  @Patch(':id/restaurar')
  @Roles('admin')
  @ApiOperation({ summary: 'Restaurar un espacio académico eliminado' })
  @ApiResponse({ status: 200, description: 'Espacio académico restaurado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Espacio académico no encontrado' })
  @ApiResponse({ status: 409, description: 'No estaba eliminado' })
  restaurar(@Param('id', ParseIntPipe) id: number) {
    return this.espaciosAcademicosService.restaurar(id);
  }
}
