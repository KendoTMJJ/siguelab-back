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
import { FacultadesService } from '../services/facultades.service';
import { CreateFacultadDto } from '../dto/facultad/create-facultad.dto';
import { UpdateFacultadDto } from '../dto/facultad/update-facultad.dto';
import { Roles } from 'src/auth/jwt/roles.decorator';
import { resolvePagination } from 'src/common/pagination/pagination.util';

@ApiTags('Facultades')
@ApiBearerAuth()
@Controller('facultades')
export class FacultadesController {
  constructor(private readonly facultadesService: FacultadesService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Crear una facultad' })
  @ApiResponse({ status: 201, description: 'Facultad creada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'División no encontrada' })
  create(@Body() createFacultadDto: CreateFacultadDto) {
    return this.facultadesService.create(createFacultadDto);
  }

  @Get()
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
    summary: 'Listar facultades activas (más recientes primero)',
  })
  @ApiResponse({ status: 200, description: 'Listado de facultades' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findAll(
    @Query('buscar') buscar?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pagination =
      page || limit ? resolvePagination(page, limit) : undefined;
    return pagination
      ? this.facultadesService.findAll(buscar, pagination)
      : this.facultadesService.findAll(buscar);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una facultad por id' })
  @ApiResponse({ status: 200, description: 'Facultad encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Facultad no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.facultadesService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar una facultad' })
  @ApiResponse({ status: 200, description: 'Facultad actualizada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({
    status: 404,
    description: 'Facultad o división no encontrada',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFacultadDto: UpdateFacultadDto,
  ) {
    return this.facultadesService.update(id, updateFacultadDto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Eliminar (soft delete) una facultad' })
  @ApiResponse({ status: 200, description: 'Facultad eliminada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Facultad no encontrada' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.facultadesService.remove(id);
  }
}
