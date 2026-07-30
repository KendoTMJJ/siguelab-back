import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Roles } from 'src/auth/jwt/roles.decorator';
import { resolvePagination } from 'src/common/pagination/pagination.util';

@ApiTags('usuarios')
@Roles('admin')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  create(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.create(createUsuarioDto);
  }

  @Get()
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
  findOne(@Param('id') id: string) {
    return this.usuariosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUsuarioDto: UpdateUsuarioDto) {
    return this.usuariosService.update(id, updateUsuarioDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usuariosService.remove(id);
  }
}
