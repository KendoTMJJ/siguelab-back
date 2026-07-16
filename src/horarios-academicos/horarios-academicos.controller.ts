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
  @Roles('admin')
  @ApiOperation({ summary: 'Crear un horario académico' })
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
  create(@Body() createHorarioAcademicoDto: CreateHorarioAcademicoDto) {
    return this.horariosAcademicosService.create(createHorarioAcademicoDto);
  }

  @Get()
  @ApiQuery({ name: 'idLaboratorio', required: false, type: Number })
  @ApiQuery({ name: 'idPeriodo', required: false, type: Number })
  @ApiQuery({
    name: 'diaSemana',
    required: false,
    enum: Object.values(DiaSemana),
  })
  @ApiOperation({ summary: 'Listar horarios académicos vigentes' })
  @ApiResponse({ status: 200, description: 'Listado de horarios académicos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findAll(
    @Query('idLaboratorio') idLaboratorio?: string,
    @Query('idPeriodo') idPeriodo?: string,
    @Query('diaSemana') diaSemana?: DiaSemana,
  ) {
    return this.horariosAcademicosService.findAll({
      idLaboratorio: idLaboratorio ? Number(idLaboratorio) : undefined,
      idPeriodo: idPeriodo ? Number(idPeriodo) : undefined,
      diaSemana,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un horario académico por id' })
  @ApiResponse({ status: 200, description: 'Horario académico encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Horario académico no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.horariosAcademicosService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({
    summary:
      'Actualizar un horario académico (el "borrado" es estado: inactivo; no hay DELETE)',
  })
  @ApiResponse({ status: 200, description: 'Horario académico actualizado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Horario académico no encontrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateHorarioAcademicoDto: UpdateHorarioAcademicoDto,
  ) {
    return this.horariosAcademicosService.update(id, updateHorarioAcademicoDto);
  }
}
