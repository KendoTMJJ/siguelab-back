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
import { TiposReservaService } from '../services/tipos-reserva.service';
import { CreateTipoReservaDto } from '../dto/tipo-reserva/create-tipo-reserva.dto';
import { UpdateTipoReservaDto } from '../dto/tipo-reserva/update-tipo-reserva.dto';
import { Roles } from 'src/auth/jwt/roles.decorator';

@ApiTags('Tipos de reserva')
@ApiBearerAuth()
@Controller('tipos-reserva')
export class TiposReservaController {
  constructor(private readonly tiposReservaService: TiposReservaService) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Crear un tipo de reserva' })
  @ApiResponse({ status: 201, description: 'Tipo de reserva creado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 409, description: 'Ya existe un tipo con ese nombre' })
  create(@Body() createTipoReservaDto: CreateTipoReservaDto) {
    return this.tiposReservaService.create(createTipoReservaDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar tipos de reserva activos (orden alfabético)',
  })
  @ApiResponse({ status: 200, description: 'Listado de tipos de reserva' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findAll() {
    return this.tiposReservaService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un tipo de reserva por id' })
  @ApiResponse({ status: 200, description: 'Tipo de reserva encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Tipo de reserva no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tiposReservaService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar un tipo de reserva' })
  @ApiResponse({ status: 200, description: 'Tipo de reserva actualizado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Tipo de reserva no encontrado' })
  @ApiResponse({ status: 409, description: 'Ya existe un tipo con ese nombre' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTipoReservaDto: UpdateTipoReservaDto,
  ) {
    return this.tiposReservaService.update(id, updateTipoReservaDto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Eliminar (soft delete) un tipo de reserva' })
  @ApiResponse({ status: 200, description: 'Tipo de reserva eliminado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Tipo de reserva no encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tiposReservaService.remove(id);
  }

  @Patch(':id/restaurar')
  @Roles('admin')
  @ApiOperation({ summary: 'Restaurar un tipo de reserva eliminado' })
  @ApiResponse({ status: 200, description: 'Tipo de reserva restaurado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Tipo de reserva no encontrado' })
  @ApiResponse({ status: 409, description: 'No estaba eliminado' })
  restaurar(@Param('id', ParseIntPipe) id: number) {
    return this.tiposReservaService.restaurar(id);
  }
}
