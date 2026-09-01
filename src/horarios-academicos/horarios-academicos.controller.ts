import {
  Body,
  Controller,
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
import { HorariosAcademicosService } from './horarios-academicos.service';
import { CreateHorarioAcademicoDto } from './dto/create-horario-academico.dto';
import { UpdateHorarioAcademicoDto } from './dto/update-horario-academico.dto';
import { DiaSemana } from './entities/horario-academico.entity';

@ApiTags('Horarios académicos')
@ApiBearerAuth()
@Controller('horarios-academicos')
export class HorariosAcademicosController {
  constructor(
    private readonly horariosAcademicosService: HorariosAcademicosService,
  ) {}

  @Post()
  @Roles('admin', 'laboratorista')
  @ApiOperation({
    summary:
      'Crear un horario académico — queda registrado a nombre de quien lo crea (ver idLaboratorista)',
  })
  @ApiResponse({ status: 201, description: 'Horario académico creado' })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos (ej. hora_fin <= hora_inicio, docente sin rol docente)',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({
    status: 404,
    description: 'Laboratorio, espacio, periodo o docente no encontrado',
  })
  create(
    @Body() createHorarioAcademicoDto: CreateHorarioAcademicoDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.horariosAcademicosService.create(
      createHorarioAcademicoDto,
      usuario,
    );
  }

  @Get()
  @ApiQuery({ name: 'idLaboratorio', required: false, type: Number })
  @ApiQuery({ name: 'idPeriodo', required: false, type: Number })
  @ApiQuery({
    name: 'diaSemana',
    required: false,
    enum: Object.values(DiaSemana),
  })
  @ApiQuery({
    name: 'buscar',
    required: false,
    description:
      'Filtra por espacio académico, laboratorio, grupo o código (contiene, sin distinguir mayúsculas)',
  })
  @ApiOperation({
    summary:
      'Listar horarios académicos vigentes — un laboratorista solo ve los que él mismo cargó, admin ve todos',
  })
  @ApiResponse({ status: 200, description: 'Listado de horarios académicos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findAll(
    @CurrentUser() usuario: AuthenticatedUser,
    @Query('idLaboratorio') idLaboratorio?: string,
    @Query('idPeriodo') idPeriodo?: string,
    @Query('diaSemana') diaSemana?: DiaSemana,
    @Query('buscar') buscar?: string,
  ) {
    return this.horariosAcademicosService.findAll(
      {
        idLaboratorio: idLaboratorio ? Number(idLaboratorio) : undefined,
        idPeriodo: idPeriodo ? Number(idPeriodo) : undefined,
        diaSemana,
        buscar,
      },
      usuario,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un horario académico por id' })
  @ApiResponse({ status: 200, description: 'Horario académico encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Un laboratorista solo puede ver los horarios que él cargó',
  })
  @ApiResponse({ status: 404, description: 'Horario académico no encontrado' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.horariosAcademicosService.findOne(id, usuario);
  }

  @Patch(':id')
  @Roles('admin', 'laboratorista')
  @ApiOperation({
    summary:
      'Actualizar un horario académico (el "borrado" es estado: inactivo; no hay DELETE) — un laboratorista solo puede editar los que él cargó',
  })
  @ApiResponse({ status: 200, description: 'Horario académico actualizado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente, o no es un horario cargado por vos',
  })
  @ApiResponse({ status: 404, description: 'Horario académico no encontrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateHorarioAcademicoDto: UpdateHorarioAcademicoDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.horariosAcademicosService.update(
      id,
      updateHorarioAcademicoDto,
      usuario,
    );
  }
}
