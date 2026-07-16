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
import { DivisionesService } from '../services/divisiones.service';
import { CreateDivisionDto } from '../dto/division/create-division.dto';
import { UpdateDivisionDto } from '../dto/division/update-division.dto';
import { Roles } from 'src/auth/jwt/roles.decorator';

@ApiTags('Divisiones')
@ApiBearerAuth()
@Controller('divisiones')
export class DivisionesController {
  constructor(private readonly divisionesService: DivisionesService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Crear una división' })
  @ApiResponse({ status: 201, description: 'División creada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una división con ese nombre',
  })
  create(@Body() createDivisionDto: CreateDivisionDto) {
    return this.divisionesService.create(createDivisionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar divisiones activas (orden alfabético)' })
  @ApiResponse({ status: 200, description: 'Listado de divisiones' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findAll() {
    return this.divisionesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una división por id' })
  @ApiResponse({ status: 200, description: 'División encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'División no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.divisionesService.findOne(id);
  }

  @Get(':id/facultades')
  @ApiOperation({ summary: 'Listar las facultades activas de una división' })
  @ApiResponse({ status: 200, description: 'Listado de facultades' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'División no encontrada' })
  findFacultades(@Param('id', ParseIntPipe) id: number) {
    return this.divisionesService.findFacultades(id);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar una división' })
  @ApiResponse({ status: 200, description: 'División actualizada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'División no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una división con ese nombre',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDivisionDto: UpdateDivisionDto,
  ) {
    return this.divisionesService.update(id, updateDivisionDto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Eliminar (soft delete) una división' })
  @ApiResponse({ status: 200, description: 'División eliminada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'División no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'Tiene facultades activas asociadas',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.divisionesService.remove(id);
  }
}
