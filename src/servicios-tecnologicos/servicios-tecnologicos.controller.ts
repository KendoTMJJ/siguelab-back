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
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/decorators/current-user.decorator';
import { multerArchivoServicioConfig } from 'src/config/uploads/multer.config';
import { ServiciosTecnologicosService } from './servicios-tecnologicos.service';
import { CreateServicioTecnologicoDto } from './dto/create-servicio-tecnologico.dto';
import { CotizarServicioDto } from './dto/cotizar-servicio.dto';
import { ResponderCotizacionDto } from './dto/responder-cotizacion.dto';
import { ProgramarServicioDto } from './dto/programar-servicio.dto';
import { CancelarServicioDto } from './dto/cancelar-servicio.dto';
import { EstadoServicioTecnologico } from './entities/servicio-tecnologico.entity';
import { resolvePagination } from 'src/common/pagination/pagination.util';

@ApiTags('Servicios tecnológicos')
@ApiBearerAuth()
@Controller('servicios-tecnologicos')
export class ServiciosTecnologicosController {
  constructor(
    private readonly serviciosTecnologicosService: ServiciosTecnologicosService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Solicitar un servicio tecnológico (cualquier rol autenticado)',
  })
  @ApiResponse({ status: 201, description: 'Servicio solicitado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 404, description: 'Equipo sugerido no encontrado' })
  create(
    @Body() dto: CreateServicioTecnologicoDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.serviciosTecnologicosService.create(dto, usuario);
  }

  @Get()
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: EstadoServicioTecnologico,
  })
  @ApiOperation({
    summary:
      'Bandeja compartida: laboratorista/admin ven todos (para atenderlos); el resto solo los propios',
  })
  @ApiResponse({ status: 200, description: 'Listado de servicios' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findAll(
    @CurrentUser() usuario: AuthenticatedUser,
    @Query('estado') estado?: EstadoServicioTecnologico,
  ) {
    return this.serviciosTecnologicosService.findAll({ estado }, usuario);
  }

  @Get('mias')
  @ApiQuery({
    name: 'archivadas',
    required: false,
    type: Boolean,
    description: 'true para ver solo los archivados, por defecto los activos',
  })
  @ApiOperation({
    summary:
      'Mis servicios solicitados — siempre solo los propios, sin importar el rol (a diferencia de la bandeja)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description:
      'Si se envía (junto con o sin `limit`), la respuesta es { data, meta }.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Listado de mis servicios' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  findMias(
    @CurrentUser() usuario: AuthenticatedUser,
    @Query('archivadas') archivadas?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const esArchivadas = archivadas === 'true';
    const pagination =
      page || limit ? resolvePagination(page, limit) : undefined;
    return pagination
      ? this.serviciosTecnologicosService.findMias(
          usuario,
          esArchivadas,
          pagination,
        )
      : this.serviciosTecnologicosService.findMias(usuario, esArchivadas);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un servicio (el solicitante, laboratorista o admin)',
  })
  @ApiResponse({ status: 200, description: 'Servicio encontrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin acceso a este servicio' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.serviciosTecnologicosService.findOne(id, usuario);
  }

  @Post(':id/archivo')
  @UseInterceptors(FileInterceptor('archivo', multerArchivoServicioConfig()))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { archivo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary:
      'Subir/reemplazar el archivo del servicio (STL/STEP/DXF/OBJ/PDF/imagen/ZIP, máx. 50MB — solo el solicitante, solo en Solicitado/En revisión)',
  })
  @ApiResponse({ status: 201, description: 'Archivo guardado' })
  @ApiResponse({
    status: 400,
    description:
      'Archivo faltante, extensión no permitida, o supera el tamaño máximo',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No eres el solicitante' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @ApiResponse({
    status: 409,
    description:
      'El servicio ya no admite cambios de archivo en su estado actual',
  })
  subirArchivo(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
    @UploadedFile() archivo: Express.Multer.File,
  ) {
    return this.serviciosTecnologicosService.subirArchivo(id, usuario, archivo);
  }

  @Get(':id/archivo')
  @ApiOperation({
    summary:
      'Descargar el archivo del servicio (el solicitante, laboratorista o admin)',
  })
  @ApiResponse({ status: 200, description: 'Archivo del servicio' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Sin acceso a este servicio' })
  @ApiResponse({
    status: 404,
    description: 'Servicio no encontrado, o sin archivo adjunto',
  })
  async descargarArchivo(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { ruta, nombreOriginal } =
      await this.serviciosTecnologicosService.obtenerArchivo(id, usuario);
    // Ver el mismo comentario en EquiposLaboratorioController — sin esto,
    // res.download deja la respuesta cacheable por defecto.
    res.download(ruta, nombreOriginal, {
      cacheControl: false,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  @Delete(':id/archivo')
  @ApiOperation({
    summary:
      'Eliminar el archivo del servicio (solo el solicitante, solo en Solicitado/En revisión)',
  })
  @ApiResponse({ status: 200, description: 'Archivo eliminado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No eres el solicitante' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @ApiResponse({
    status: 409,
    description:
      'El servicio ya no admite cambios de archivo en su estado actual',
  })
  eliminarArchivo(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.serviciosTecnologicosService.eliminarArchivo(id, usuario);
  }

  @Post(':id/cotizar')
  @Roles('laboratorista', 'admin')
  @ApiOperation({
    summary:
      'Revisar y cotizar el servicio en un solo paso, asignando el/los equipo(s) reales (laboratorista o admin)',
  })
  @ApiResponse({ status: 201, description: 'Cotización creada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Servicio o equipo no encontrado' })
  @ApiResponse({
    status: 409,
    description:
      'El servicio no está en un estado cotizable, o algún equipo no admite programación',
  })
  cotizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CotizarServicioDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.serviciosTecnologicosService.cotizar(id, dto, usuario);
  }

  @Post(':id/responder-cotizacion')
  @ApiOperation({
    summary: 'Aprobar o rechazar la cotización (solo el solicitante)',
  })
  @ApiResponse({ status: 200, description: 'Respuesta registrada' })
  @ApiResponse({ status: 400, description: 'Falta el motivo de rechazo' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'No eres el solicitante' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'El servicio no tiene una cotización pendiente',
  })
  responderCotizacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResponderCotizacionDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.serviciosTecnologicosService.responderCotizacion(
      id,
      dto,
      usuario,
    );
  }

  @Patch(':id/programar')
  @Roles('laboratorista', 'admin')
  @ApiOperation({
    summary:
      'Asignar fecha/horario a cada equipo cotizado (laboratorista o admin)',
  })
  @ApiResponse({ status: 200, description: 'Servicio programado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @ApiResponse({
    status: 409,
    description:
      'El servicio no está aprobado, o algún equipo no admite programación',
  })
  programar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProgramarServicioDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.serviciosTecnologicosService.programar(id, dto, usuario);
  }

  @Patch(':id/equipos/:idEquipo/iniciar')
  @Roles('laboratorista', 'admin')
  @ApiOperation({
    summary:
      'Marcar el inicio real de uso de un equipo del servicio (laboratorista o admin)',
  })
  @ApiResponse({ status: 200, description: 'Inicio registrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Estado inválido o el equipo ya fue iniciado',
  })
  iniciarEquipo(
    @Param('id', ParseIntPipe) id: number,
    @Param('idEquipo', ParseIntPipe) idEquipo: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.serviciosTecnologicosService.iniciarEquipo(
      id,
      idEquipo,
      usuario,
    );
  }

  @Patch(':id/equipos/:idEquipo/finalizar')
  @Roles('laboratorista', 'admin')
  @ApiOperation({
    summary:
      'Marcar el fin real de uso de un equipo del servicio — cuando todos los equipos terminan, el servicio pasa a Finalizado (laboratorista o admin)',
  })
  @ApiResponse({ status: 200, description: 'Fin registrado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Estado inválido, no fue iniciado, o ya fue finalizado',
  })
  finalizarEquipo(
    @Param('id', ParseIntPipe) id: number,
    @Param('idEquipo', ParseIntPipe) idEquipo: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.serviciosTecnologicosService.finalizarEquipo(
      id,
      idEquipo,
      usuario,
    );
  }

  @Patch(':id/entregar')
  @Roles('laboratorista', 'admin')
  @ApiOperation({
    summary:
      'Marcar el servicio como entregado — cierra el servicio (laboratorista o admin)',
  })
  @ApiResponse({ status: 200, description: 'Servicio entregado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Rol insuficiente' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @ApiResponse({ status: 409, description: 'El servicio no está finalizado' })
  entregar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.serviciosTecnologicosService.entregar(id, usuario);
  }

  @Patch(':id/cancelar')
  @ApiOperation({
    summary: 'Cancelar el servicio (el solicitante o un admin)',
  })
  @ApiResponse({ status: 200, description: 'Servicio cancelado' })
  @ApiResponse({ status: 400, description: 'Falta el motivo' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Solo el solicitante o un admin pueden cancelar',
  })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'No se puede cancelar en su estado actual',
  })
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelarServicioDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.serviciosTecnologicosService.cancelar(id, dto, usuario);
  }

  @Patch(':id/archivar')
  @ApiOperation({
    summary:
      'Ocultar el servicio de "Mis solicitudes" (solo el solicitante, solo si está rechazado o cancelado)',
  })
  @ApiResponse({ status: 200, description: 'Servicio archivado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Solo el solicitante puede archivar su servicio',
  })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'No se puede archivar en su estado actual',
  })
  archivar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.serviciosTecnologicosService.archivar(id, usuario);
  }

  @Patch(':id/desarchivar')
  @ApiOperation({
    summary: 'Restaurar el servicio a "Mis solicitudes" (solo el solicitante)',
  })
  @ApiResponse({ status: 200, description: 'Servicio restaurado' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Solo el solicitante puede restaurar su servicio',
  })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado' })
  desarchivar(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.serviciosTecnologicosService.desarchivar(id, usuario);
  }

  @Delete('mias/archivados')
  @ApiOperation({
    summary:
      'Borrar definitivamente TODOS mis servicios archivados (no se puede deshacer)',
  })
  @ApiResponse({ status: 200, description: '{ eliminados: number }' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async vaciarArchivados(@CurrentUser() usuario: AuthenticatedUser) {
    const eliminados =
      await this.serviciosTecnologicosService.vaciarArchivados(usuario);
    return { eliminados };
  }
}
