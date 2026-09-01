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
import { EventosLaboratorioService } from './eventos-laboratorio.service';
import { CreateEventoLaboratorioDto } from './dto/create-evento-laboratorio.dto';
import { RechazarEventoDto } from './dto/rechazar-evento.dto';
import { CancelarEventoDto } from './dto/cancelar-evento.dto';
import { EstadoEvento } from './entities/evento-laboratorio.entity';

@ApiTags('Eventos de laboratorio')
@ApiBearerAuth()
@Controller('eventos-laboratorio')
export class EventosLaboratorioController {
  constructor(
    private readonly eventosLaboratorioService: EventosLaboratorioService,
  ) {}

  @Post()
  @Roles('docente', 'laboratorista', 'admin')
  @ApiOperation({
    summary:
      'Solicitar un evento especial (capacitación, taller, visita, etc. — docente, laboratorista o admin)',
  })
  @ApiResponse({ status: 201, description: 'Evento solicitado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({
    status: 404,
    description: 'Laboratorio o algún equipo no encontrado',
  })
  @ApiResponse({
    status: 409,
    description: 'Sin disponibilidad en ese horario',
  })
  create(
    @Body() dto: CreateEventoLaboratorioDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.eventosLaboratorioService.create(dto, usuario);
  }

  @Get()
  @ApiQuery({ name: 'estado', required: false, enum: EstadoEvento })
  @ApiOperation({
    summary:
      'Listar eventos (laboratorista/admin ven todos; el resto solo los propios)',
  })
  @ApiResponse({ status: 200, description: 'Listado de eventos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findAll(
    @CurrentUser() usuario: AuthenticatedUser,
    @Query('estado') estado?: EstadoEvento,
  ) {
    return this.eventosLaboratorioService.findAll({ estado }, usuario);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un evento (el solicitante, laboratorista o admin)',
  })
  @ApiResponse({ status: 200, description: 'Evento encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin acceso a este evento' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.eventosLaboratorioService.findOne(id, usuario);
  }

  @Patch(':id/aprobar')
  @Roles('laboratorista', 'admin')
  @ApiOperation({ summary: 'Aprobar el evento (laboratorista o admin)' })
  @ApiResponse({ status: 200, description: 'Evento aprobado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'El evento no está solicitado, o ya no hay disponibilidad',
  })
  aprobar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.eventosLaboratorioService.aprobar(id, usuario);
  }

  @Patch(':id/rechazar')
  @Roles('laboratorista', 'admin')
  @ApiOperation({ summary: 'Rechazar el evento (laboratorista o admin)' })
  @ApiResponse({ status: 200, description: 'Evento rechazado' })
  @ApiResponse({ status: 400, description: 'Falta el motivo' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  @ApiResponse({ status: 409, description: 'El evento no está solicitado' })
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RechazarEventoDto,
  ) {
    return this.eventosLaboratorioService.rechazar(id, dto);
  }

  @Patch(':id/cancelar')
  @ApiOperation({ summary: 'Cancelar el evento (el solicitante o un admin)' })
  @ApiResponse({ status: 200, description: 'Evento cancelado' })
  @ApiResponse({ status: 400, description: 'Falta el motivo' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Solo el solicitante o un admin pueden cancelar',
  })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'No se puede cancelar en su estado actual',
  })
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelarEventoDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.eventosLaboratorioService.cancelar(id, dto, usuario);
  }

  @Patch(':id/archivar')
  @ApiOperation({
    summary:
      'Ocultar el evento de "Mis solicitudes" (solo el solicitante, solo si está rechazado o cancelado)',
  })
  @ApiResponse({ status: 200, description: 'Evento archivado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Solo el solicitante puede archivar su evento',
  })
  @ApiResponse({ status: 404, description: 'Evento no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'No se puede archivar en su estado actual',
  })
  archivar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.eventosLaboratorioService.archivar(id, usuario);
  }
}
