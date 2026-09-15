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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/auth/jwt/roles.decorator';
import { multerFichaTecnicaConfig } from 'src/config/uploads/multer.config';
import { EquiposLaboratorioService } from './equipos-laboratorio.service';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';
import { CambiarEstadoEquipoDto } from './dto/cambiar-estado-equipo.dto';
import { resolvePagination } from 'src/common/pagination/pagination.util';

@ApiTags('Equipos de laboratorio')
@ApiBearerAuth()
@Controller('equipos')
export class EquiposLaboratorioController {
  constructor(
    private readonly equiposLaboratorioService: EquiposLaboratorioService,
  ) {}

  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Registrar un equipo (una fila por unidad física)' })
  @ApiResponse({ status: 201, description: 'Equipo creado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({
    status: 404,
    description: 'Laboratorio no encontrado',
  })
  @ApiResponse({ status: 409, description: 'Laboratorio inactivo' })
  create(@Body() createEquipoDto: CreateEquipoDto) {
    return this.equiposLaboratorioService.create(createEquipoDto);
  }

  @Get()
  @ApiQuery({ name: 'idLaboratorio', required: false, type: Number })
  @ApiQuery({ name: 'incluirInactivos', required: false, type: Boolean })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description:
      'Si se envía (junto con o sin `limit`), la respuesta es { data, meta }. Si se omiten ambos, devuelve el arreglo completo (lo usan otras pantallas, ej. Bandeja/Mis solicitudes).',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOperation({ summary: 'Listar equipos (cualquier rol autenticado)' })
  @ApiResponse({ status: 200, description: 'Listado de equipos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findAll(
    @Query('idLaboratorio') idLaboratorio?: string,
    @Query('incluirInactivos') incluirInactivos?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filtros = {
      idLaboratorio: idLaboratorio ? Number(idLaboratorio) : undefined,
      incluirInactivos: incluirInactivos === 'true',
    };
    const pagination =
      page || limit ? resolvePagination(page, limit) : undefined;
    return pagination
      ? this.equiposLaboratorioService.findAll(filtros, pagination)
      : this.equiposLaboratorioService.findAll(filtros);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un equipo por id' })
  @ApiResponse({ status: 200, description: 'Equipo encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.equiposLaboratorioService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Actualizar los datos de un equipo' })
  @ApiResponse({ status: 200, description: 'Equipo actualizado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEquipoDto: UpdateEquipoDto,
  ) {
    return this.equiposLaboratorioService.update(id, updateEquipoDto);
  }

  @Post(':id/ficha-tecnica')
  @Roles('laboratorista', 'admin')
  @UseInterceptors(FileInterceptor('archivo', multerFichaTecnicaConfig()))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { archivo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary:
      'Subir/reemplazar la ficha técnica del equipo (PDF/JPG/PNG/WEBP, máx. 10MB — laboratorista o admin)',
  })
  @ApiResponse({ status: 201, description: 'Ficha técnica guardada' })
  @ApiResponse({
    status: 400,
    description:
      'Archivo faltante, tipo no permitido, o supera el tamaño máximo',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  subirFichaTecnica(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() archivo: Express.Multer.File,
  ) {
    return this.equiposLaboratorioService.subirFichaTecnica(id, archivo);
  }

  @Get(':id/ficha-tecnica')
  @ApiOperation({
    summary:
      'Descargar la ficha técnica del equipo (cualquier rol autenticado)',
  })
  @ApiResponse({ status: 200, description: 'Archivo de la ficha técnica' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 404,
    description: 'Equipo no encontrado, o no tiene ficha técnica cargada',
  })
  async descargarFichaTecnica(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const { ruta, nombreOriginal, mimeType } =
      await this.equiposLaboratorioService.obtenerFichaTecnica(id);
    // cacheControl:false + Cache-Control:no-store — sin esto, res.download
    // (vía res.sendFile) activa cacheo por defecto (ETag/Last-Modified/
    // Accept-Ranges, pensado para estáticos). Un proxy/CDN intermedio podía
    // guardar la respuesta por URL y, si un envío quedaba corrupto o
    // truncado, seguir sirviendo esa copia corrupta a todos después.
    res.download(ruta, nombreOriginal, {
      cacheControl: false,
      headers: { 'Content-Type': mimeType, 'Cache-Control': 'no-store' },
    });
  }

  @Delete(':id/ficha-tecnica')
  @Roles('laboratorista', 'admin')
  @ApiOperation({
    summary: 'Eliminar la ficha técnica del equipo (laboratorista o admin)',
  })
  @ApiResponse({ status: 200, description: 'Ficha técnica eliminada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  eliminarFichaTecnica(@Param('id', ParseIntPipe) id: number) {
    return this.equiposLaboratorioService.eliminarFichaTecnica(id);
  }

  @Patch(':id/estado')
  @Roles('laboratorista', 'admin')
  @ApiOperation({
    summary:
      'Marcar un equipo en mantenimiento/fuera de servicio, o devolverlo a disponible (laboratorista o admin)',
  })
  @ApiResponse({ status: 200, description: 'Estado actualizado' })
  @ApiResponse({
    status: 400,
    description: 'El estado indicado no es asignable manualmente',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoEquipoDto,
  ) {
    return this.equiposLaboratorioService.cambiarEstado(id, dto.estado);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Eliminar (soft delete) un equipo' })
  @ApiResponse({ status: 200, description: 'Equipo eliminado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.equiposLaboratorioService.remove(id);
  }

  @Patch(':id/restaurar')
  @Roles('admin')
  @ApiOperation({ summary: 'Restaurar un equipo eliminado' })
  @ApiResponse({ status: 200, description: 'Equipo restaurado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Equipo no encontrado' })
  @ApiResponse({ status: 409, description: 'No estaba eliminado' })
  restaurar(@Param('id', ParseIntPipe) id: number) {
    return this.equiposLaboratorioService.restaurar(id);
  }
}
