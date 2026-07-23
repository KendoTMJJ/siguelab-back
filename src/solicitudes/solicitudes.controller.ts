import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { SolicitudesService } from './solicitudes.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { CreateSolicitudDirectaDto } from './dto/create-solicitud-directa.dto';
import { RechazarSolicitudDto } from './dto/rechazar-solicitud.dto';
import { CancelarSolicitudDto } from './dto/cancelar-solicitud.dto';
import { EstadoSolicitud } from './entities/solicitud-reserva.entity';

@ApiTags('Solicitudes')
@ApiBearerAuth()
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post()
  @Roles('estudiante', 'docente')
  @ApiOperation({ summary: 'Crear una solicitud de reserva' })
  @ApiResponse({ status: 201, description: 'Solicitud creada' })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos (reglas de negocio)',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente para el tipo de reserva',
  })
  @ApiResponse({
    status: 404,
    description: 'Alguna entidad referenciada no existe',
  })
  @ApiResponse({
    status: 409,
    description: 'Sin disponibilidad u otro conflicto',
  })
  create(
    @Body() createSolicitudDto: CreateSolicitudDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.create(createSolicitudDto, usuario);
  }

  @Post('directa')
  @Roles('admin')
  @ApiOperation({
    summary:
      'Crear una solicitud ya aprobada, sin firmas (solo admin)',
  })
  @ApiResponse({ status: 201, description: 'Solicitud creada y aprobada' })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos (reglas de negocio)',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente (solo admin)' })
  @ApiResponse({
    status: 404,
    description: 'Alguna entidad referenciada no existe',
  })
  @ApiResponse({
    status: 409,
    description: 'Sin disponibilidad u otro conflicto',
  })
  crearDirecta(
    @Body() dto: CreateSolicitudDirectaDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.crearDirecta(dto, usuario);
  }

  @Get('mias')
  @ApiOperation({ summary: 'Listar mis solicitudes (con firmas embebidas)' })
  @ApiResponse({ status: 200, description: 'Listado de mis solicitudes' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findMias(@CurrentUser() usuario: AuthenticatedUser) {
    return this.solicitudesService.findMias(usuario);
  }

  @Get('pendientes-de-mi-firma')
  @ApiOperation({
    summary:
      'Bandeja de firmas pendientes (docente: las suyas; laboratorista: todas)',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de solicitudes pendientes',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findPendientesDeMiFirma(@CurrentUser() usuario: AuthenticatedUser) {
    return this.solicitudesService.findPendientesDeMiFirma(usuario);
  }

  @Get()
  @Roles('laboratorista', 'admin')
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: Object.values(EstadoSolicitud),
  })
  @ApiQuery({ name: 'idLaboratorio', required: false, type: Number })
  @ApiQuery({ name: 'idPeriodo', required: false, type: Number })
  @ApiOperation({
    summary: 'Listar todas las solicitudes (laboratorista/admin)',
  })
  @ApiResponse({ status: 200, description: 'Listado de solicitudes' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  findAll(
    @Query('estado') estado?: EstadoSolicitud,
    @Query('idLaboratorio') idLaboratorio?: string,
    @Query('idPeriodo') idPeriodo?: string,
  ) {
    return this.solicitudesService.findAll({
      estado,
      idLaboratorio: idLaboratorio ? Number(idLaboratorio) : undefined,
      idPeriodo: idPeriodo ? Number(idPeriodo) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary:
      'Obtener una solicitud (solicitante, firmantes, laboratorista o admin)',
  })
  @ApiResponse({ status: 200, description: 'Solicitud encontrada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin acceso a esta solicitud' })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.findOne(id, usuario);
  }

  @Post(':id/firmar')
  @ApiOperation({
    summary:
      'Firmar (aprobar) la solicitud en el punto del flujo que corresponda',
  })
  @ApiResponse({ status: 200, description: 'Firma resuelta' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'No te corresponde firmar en este punto',
  })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'Sin disponibilidad u otra persona ya resolvió la firma',
  })
  firmar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.firmar(id, usuario);
  }

  @Post(':id/rechazar')
  @ApiOperation({
    summary: 'Rechazar la solicitud en el punto del flujo que corresponda',
  })
  @ApiResponse({ status: 200, description: 'Solicitud rechazada' })
  @ApiResponse({ status: 400, description: 'Falta el motivo' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'No te corresponde rechazar en este punto',
  })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  @ApiResponse({ status: 409, description: 'Ya fue resuelta por otra persona' })
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body() rechazarSolicitudDto: RechazarSolicitudDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.rechazar(id, usuario, rechazarSolicitudDto);
  }

  @Post(':id/cancelar')
  @ApiOperation({ summary: 'Cancelar la solicitud (solicitante o admin)' })
  @ApiResponse({ status: 200, description: 'Solicitud cancelada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Solo el solicitante o un admin pueden cancelar',
  })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'No se puede cancelar en su estado actual',
  })
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body() cancelarSolicitudDto: CancelarSolicitudDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.cancelar(id, usuario, cancelarSolicitudDto);
  }
}
