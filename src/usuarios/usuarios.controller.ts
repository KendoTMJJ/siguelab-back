import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UpdateUsuarioPropioDto } from './dto/update-usuario-propio.dto';
import { Roles } from 'src/auth/jwt/roles.decorator';
import { resolvePagination } from 'src/common/pagination/pagination.util';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/decorators/current-user.decorator';

/**
 * No hay endpoint de creación: los usuarios se dan de alta solos en su
 * primer login con Microsoft (ver UsuariosService.findOrCreateByOid). El
 * admin puede listar, ver, cambiar el rol/nombre y eliminar; cualquier
 * usuario autenticado puede editar su propio nombre vía PATCH /usuarios/me.
 */
@ApiTags('usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  /**
   * Abierto también a laboratorista: el módulo de horarios académicos
   * necesita listar docentes (filtro ?rol=docente) para el selector de
   * "docente encargado" al crear un horario, tanto en el formulario manual
   * como en la carga masiva por Excel.
   */
  @Get()
  @Roles('admin', 'laboratorista')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Máx. 100, por defecto 20',
  })
  @ApiQuery({
    name: 'buscar',
    required: false,
    description:
      'Filtra por nombre (contiene, sin distinguir mayúsculas) — reemplaza al antiguo /usuarios/nombre/:nombreUsuario',
  })
  @ApiQuery({
    name: 'rol',
    required: false,
    description: 'Filtra por nombre de rol exacto (ej. "docente")',
  })
  @ApiQuery({ name: 'estado', required: false, enum: ['activo', 'inactivo'] })
  @ApiOperation({ summary: 'Listar usuarios (paginado)' })
  @ApiResponse({
    status: 200,
    description: '{ data, meta: { total, page, limit, totalPages } }',
  })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('buscar') buscar?: string,
    @Query('rol') rol?: string,
    @Query('estado') estado?: string,
  ) {
    return this.usuariosService.findAll(
      resolvePagination(page, limit),
      buscar,
      rol,
      estado,
    );
  }

  @Get(':id')
  @Roles('admin', 'laboratorista')
  findOne(@Param('id') id: string) {
    return this.usuariosService.findOne(id);
  }

  /**
   * Antes de la ruta ':id' a propósito: '/usuarios/me' matchearía contra
   * ':id' (con "me" como valor literal) si esta se declarara después.
   */
  @Patch('me')
  @ApiOperation({ summary: 'El usuario autenticado edita su propio nombre' })
  @ApiResponse({ status: 200, description: 'Nombre actualizado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  actualizarPropio(
    @CurrentUser() usuario: AuthenticatedUser,
    @Body() dto: UpdateUsuarioPropioDto,
  ) {
    return this.usuariosService.actualizarNombrePropio(usuario.id, dto.nombre);
  }

  @Patch(':id')
  @Roles('admin')
  update(@Param('id') id: string, @Body() updateUsuarioDto: UpdateUsuarioDto) {
    return this.usuariosService.update(id, updateUsuarioDto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.usuariosService.remove(id);
  }
}
