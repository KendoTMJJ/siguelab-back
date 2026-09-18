import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
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
import { SolicitudesService } from './solicitudes.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { CreateSolicitudDirectaDto } from './dto/create-solicitud-directa.dto';
import { CreateSolicitudDirectaLoteDto } from './dto/create-solicitud-directa-lote.dto';
import { RechazarSolicitudDto } from './dto/rechazar-solicitud.dto';
import { FirmarSolicitudDto } from './dto/firmar-solicitud.dto';
import { CancelarSolicitudDto } from './dto/cancelar-solicitud.dto';
import { EstadoSolicitud } from './entities/solicitud-reserva.entity';
import { resolvePagination } from 'src/common/pagination/pagination.util';

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
  @Roles('admin', 'laboratorista')
  @ApiOperation({
    summary:
      'Crear una solicitud ya aprobada, sin firmas (admin y laboratorista)',
  })
  @ApiResponse({ status: 201, description: 'Solicitud creada y aprobada' })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos (reglas de negocio)',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente (solo admin o laboratorista)',
  })
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

  @Post('directa-lote')
  @Roles('admin', 'laboratorista')
  @ApiOperation({
    summary:
      'Crear un evento especial de varios días (admin/laboratorista): una solicitud aprobada por cada fecha, todo o nada',
  })
  @ApiResponse({
    status: 201,
    description: 'Solicitudes creadas y aprobadas (una por fecha)',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos (reglas de negocio)',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Rol insuficiente (solo admin o laboratorista)',
  })
  @ApiResponse({
    status: 404,
    description: 'Alguna entidad referenciada no existe',
  })
  @ApiResponse({
    status: 409,
    description: 'Sin disponibilidad en alguna de las fechas: no se crea nada',
  })
  crearDirectaLote(
    @Body() dto: CreateSolicitudDirectaLoteDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.crearDirectaLote(dto, usuario);
  }

  @Get('mias')
  @ApiQuery({
    name: 'archivadas',
    required: false,
    type: Boolean,
    description: 'true para ver solo las archivadas, por defecto las activas',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description:
      'Si se envía (junto con o sin `limit`), la respuesta es { data, meta }. Si se omiten ambos, devuelve el arreglo completo (lo usa Inicio para sus contadores).',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'soloEspeciales',
    required: false,
    type: Boolean,
    description:
      'true: solo reservas especiales de varios días; false: solo reservas normales (las excluye); ausente: todo, sin filtrar (usado por los contadores de Inicio)',
  })
  @ApiOperation({ summary: 'Listar mis solicitudes (con firmas embebidas)' })
  @ApiResponse({ status: 200, description: 'Listado de mis solicitudes' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findMias(
    @CurrentUser() usuario: AuthenticatedUser,
    @Query('archivadas') archivadas?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('soloEspeciales') soloEspeciales?: string,
  ) {
    const esArchivadas = archivadas === 'true';
    const pagination =
      page || limit ? resolvePagination(page, limit) : undefined;
    const filtroEspeciales =
      soloEspeciales === undefined ? undefined : soloEspeciales === 'true';
    return pagination
      ? this.solicitudesService.findMias(
          usuario,
          esArchivadas,
          pagination,
          filtroEspeciales,
        )
      : this.solicitudesService.findMias(
          usuario,
          esArchivadas,
          undefined,
          filtroEspeciales,
        );
  }

  @Get('pendientes-de-mi-firma')
  @ApiOperation({
    summary:
      'Bandeja de firmas pendientes (docente: las suyas; laboratorista: las de los laboratorios que tiene asignados)',
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
  @Roles('docente', 'laboratorista', 'admin')
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: Object.values(EstadoSolicitud),
  })
  @ApiQuery({ name: 'idLaboratorio', required: false, type: Number })
  @ApiQuery({ name: 'idPeriodo', required: false, type: Number })
  @ApiQuery({
    name: 'nombreLaboratorio',
    required: false,
    description: 'Filtra por nombre del laboratorio (contiene)',
  })
  @ApiQuery({
    name: 'nombreSolicitante',
    required: false,
    description: 'Filtra por nombre de quien creó la solicitud (contiene)',
  })
  @ApiQuery({ name: 'fechaDesde', required: false, type: String })
  @ApiQuery({ name: 'fechaHasta', required: false, type: String })
  @ApiQuery({
    name: 'soloEventosEspeciales',
    required: false,
    type: Boolean,
    description:
      'true: solo solicitudes de una reserva especial de varios días',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Máx. 100, por defecto 20',
  })
  @ApiOperation({
    summary:
      'Historial de solicitudes (docente: las suyas como encargado; laboratorista/admin: todas) — paginado',
  })
  @ApiResponse({
    status: 200,
    description: '{ data, meta: { total, page, limit, totalPages } }',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  findAll(
    @CurrentUser() usuario: AuthenticatedUser,
    @Query('estado') estado?: EstadoSolicitud,
    @Query('idLaboratorio') idLaboratorio?: string,
    @Query('idPeriodo') idPeriodo?: string,
    @Query('nombreLaboratorio') nombreLaboratorio?: string,
    @Query('nombreSolicitante') nombreSolicitante?: string,
    @Query('fechaDesde') fechaDesde?: string,
    @Query('fechaHasta') fechaHasta?: string,
    @Query('soloEventosEspeciales') soloEventosEspeciales?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.solicitudesService.findAll(
      usuario,
      {
        estado,
        idLaboratorio: idLaboratorio ? Number(idLaboratorio) : undefined,
        idPeriodo: idPeriodo ? Number(idPeriodo) : undefined,
        nombreLaboratorio,
        nombreSolicitante,
        fechaDesde,
        fechaHasta,
        soloEventosEspeciales: soloEventosEspeciales === 'true',
      },
      resolvePagination(page, limit),
    );
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
    @Body() firmarSolicitudDto: FirmarSolicitudDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.firmar(id, usuario, firmarSolicitudDto);
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

  @Post('lote/:idLoteEspecial/cancelar')
  @ApiOperation({
    summary:
      'Cancelar de un golpe todas las solicitudes vivas de un evento especial (solicitante o admin)',
  })
  @ApiResponse({ status: 200, description: 'Solicitudes canceladas' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Solo el solicitante o un admin pueden cancelar',
  })
  @ApiResponse({ status: 404, description: 'Evento especial no encontrado' })
  @ApiResponse({
    status: 409,
    description:
      'Ninguna solicitud del evento se puede cancelar en su estado actual',
  })
  cancelarLote(
    @Param('idLoteEspecial', ParseUUIDPipe) idLoteEspecial: string,
    @Body() cancelarSolicitudDto: CancelarSolicitudDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.cancelarLote(
      idLoteEspecial,
      usuario,
      cancelarSolicitudDto,
    );
  }

  @Patch('lote/:idLoteEspecial/archivar')
  @ApiOperation({
    summary:
      'Archivar de un golpe las solicitudes resueltas de un evento especial (solo admin/laboratorista — desaparece de la lista para todos)',
  })
  @ApiResponse({
    status: 200,
    description: 'Solicitudes archivadas del evento',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description:
      'Solo admin o laboratorista pueden gestionar reservas especiales',
  })
  @ApiResponse({ status: 404, description: 'Evento especial no encontrado' })
  @ApiResponse({
    status: 409,
    description:
      'Ninguna solicitud del evento se puede archivar en su estado actual',
  })
  archivarLote(
    @Param('idLoteEspecial', ParseUUIDPipe) idLoteEspecial: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.archivarLote(idLoteEspecial, usuario);
  }

  @Patch('lote/:idLoteEspecial/desarchivar')
  @ApiOperation({
    summary:
      'Restaurar de un golpe todas las solicitudes de un evento especial archivado (solo admin/laboratorista)',
  })
  @ApiResponse({
    status: 200,
    description: 'Solicitudes restauradas del evento',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description:
      'Solo admin o laboratorista pueden gestionar reservas especiales',
  })
  @ApiResponse({ status: 404, description: 'Evento especial no encontrado' })
  desarchivarLote(
    @Param('idLoteEspecial', ParseUUIDPipe) idLoteEspecial: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.desarchivarLote(idLoteEspecial, usuario);
  }

  @Delete('lote/archivadas')
  @ApiOperation({
    summary:
      'Borrar definitivamente TODAS las reservas especiales archivadas del sistema (solo admin/laboratorista — no se puede deshacer)',
  })
  @ApiResponse({ status: 200, description: '{ eliminadas: number }' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description:
      'Solo admin o laboratorista pueden gestionar reservas especiales',
  })
  async vaciarArchivadasEspeciales(@CurrentUser() usuario: AuthenticatedUser) {
    const eliminadas =
      await this.solicitudesService.vaciarArchivadasEspeciales(usuario);
    return { eliminadas };
  }

  @Patch(':id/archivar')
  @ApiOperation({
    summary:
      'Ocultar la solicitud de "Mis solicitudes" (solo el solicitante, solo si está rechazada o cancelada — no la borra, sigue en Historial/Estadísticas)',
  })
  @ApiResponse({ status: 200, description: 'Solicitud archivada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Solo el solicitante puede archivar su solicitud',
  })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'No se puede archivar en su estado actual',
  })
  archivar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.archivar(id, usuario);
  }

  @Patch(':id/desarchivar')
  @ApiOperation({
    summary: 'Restaurar la solicitud a "Mis solicitudes" (solo el solicitante)',
  })
  @ApiResponse({ status: 200, description: 'Solicitud restaurada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Solo el solicitante puede restaurar su solicitud',
  })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  desarchivar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.desarchivar(id, usuario);
  }

  @Delete('mias/archivadas')
  @ApiOperation({
    summary:
      'Borrar definitivamente TODAS mis solicitudes archivadas (no se puede deshacer — también desaparecen de Historial/Estadísticas)',
  })
  @ApiResponse({ status: 200, description: '{ eliminadas: number }' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async vaciarArchivadas(@CurrentUser() usuario: AuthenticatedUser) {
    const eliminadas = await this.solicitudesService.vaciarArchivadas(usuario);
    return { eliminadas };
  }
}
