import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import type { AuthenticatedUser } from 'src/auth/decorators/current-user.decorator';
import { EquiposLaboratorioService } from 'src/equipos-laboratorio/equipos-laboratorio.service';
import { LaboratoriosService } from 'src/laboratorios/services/laboratorios.service';
import { ServiciosService } from 'src/servicios/servicios.service';
import { EstadoServicio } from 'src/servicios/entities/servicio.entity';
import {
  EstadoLaboratorio,
  ModoReservaLaboratorio,
} from 'src/laboratorios/entities/laboratorio.entity';
import {
  HorarioAcademico,
  EstadoHorario,
} from 'src/horarios-academicos/entities/horario-academico.entity';
import {
  EventoLaboratorio,
  EstadoEvento,
  ModalidadEvento,
} from 'src/eventos-laboratorio/entities/evento-laboratorio.entity';
import {
  diaSemanaDeFecha,
  horasCruzan,
} from 'src/common/utils/fecha-horario.util';
import { UPLOADS_ROOT } from 'src/config/uploads/multer.config';
import { Usuario, EstadoUsuario } from 'src/usuarios/entities/usuario.entity';
import { Rol } from 'src/roles/entities/rol.entity';
import { NotificacionesService } from 'src/notificaciones/notificaciones.service';
import { TipoEventoNotificacion } from 'src/notificaciones/entities/notificacion.entity';
import {
  ServicioTecnologico,
  EstadoServicioTecnologico,
  archivoEsEditableEnEstado,
} from './entities/servicio-tecnologico.entity';
import { CotizacionServicio } from './entities/cotizacion-servicio.entity';
import { CotizacionEquipo } from './entities/cotizacion-equipo.entity';
import { CreateServicioTecnologicoDto } from './dto/create-servicio-tecnologico.dto';
import { CotizarServicioDto } from './dto/cotizar-servicio.dto';
import { ResponderCotizacionDto } from './dto/responder-cotizacion.dto';
import { ProgramarServicioDto } from './dto/programar-servicio.dto';
import { CancelarServicioDto } from './dto/cancelar-servicio.dto';
import {
  PaginatedResult,
  buildPaginatedResult,
} from 'src/common/pagination/paginated-result.interface';
import { PaginationParams } from 'src/common/pagination/pagination.util';

const CARPETA_ARCHIVO = 'servicios-tecnologicos';

export interface FiltrosServicios {
  estado?: EstadoServicioTecnologico;
}

@Injectable()
export class ServiciosTecnologicosService {
  private readonly servicioRepository: Repository<ServicioTecnologico>;
  private readonly cotizacionRepository: Repository<CotizacionServicio>;
  private readonly cotizacionEquipoRepository: Repository<CotizacionEquipo>;
  private readonly horarioAcademicoRepository: Repository<HorarioAcademico>;
  private readonly eventoLaboratorioRepository: Repository<EventoLaboratorio>;
  private readonly usuarioRepository: Repository<Usuario>;
  private readonly rolRepository: Repository<Rol>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly equiposLaboratorioService: EquiposLaboratorioService,
    private readonly laboratoriosService: LaboratoriosService,
    private readonly serviciosService: ServiciosService,
    private readonly notificacionesService: NotificacionesService,
  ) {
    this.servicioRepository =
      this.dataSource.getRepository(ServicioTecnologico);
    this.cotizacionRepository =
      this.dataSource.getRepository(CotizacionServicio);
    this.cotizacionEquipoRepository =
      this.dataSource.getRepository(CotizacionEquipo);
    this.horarioAcademicoRepository =
      this.dataSource.getRepository(HorarioAcademico);
    this.eventoLaboratorioRepository =
      this.dataSource.getRepository(EventoLaboratorio);
    this.usuarioRepository = this.dataSource.getRepository(Usuario);
    this.rolRepository = this.dataSource.getRepository(Rol);
  }

  private esLaboratoristaOAdmin(usuario: AuthenticatedUser): boolean {
    return usuario.rol === 'laboratorista' || usuario.rol === 'admin';
  }

  /** Mismo patrón que SolicitudesService.todosLosLaboratoristas. */
  private async todosLosLaboratoristas(): Promise<
    { idUsuario: string; correo: string }[]
  > {
    const rolLaboratorista = await this.rolRepository.findOne({
      where: { nombre: 'laboratorista' },
    });
    if (!rolLaboratorista) return [];

    const usuarios = await this.usuarioRepository.find({
      where: {
        rol: { idRol: rolLaboratorista.idRol },
        estado: EstadoUsuario.ACTIVO,
      },
    });
    return usuarios.map((u) => ({ idUsuario: u.idUsuario, correo: u.correo }));
  }

  private async destinatarioSolicitante(
    idSolicitante: string,
  ): Promise<{ idUsuario: string; correo: string }[]> {
    const usuario = await this.usuarioRepository.findOne({
      where: { idUsuario: idSolicitante },
    });
    return usuario
      ? [{ idUsuario: usuario.idUsuario, correo: usuario.correo }]
      : [];
  }

  private async findConCotizacion(id: number): Promise<ServicioTecnologico> {
    const servicio = await this.servicioRepository.findOne({
      where: { idServicio: id },
      relations: { cotizacion: { equipos: true }, servicioSolicitado: true },
    });
    if (!servicio) {
      throw new HttpException('Servicio no encontrado', HttpStatus.NOT_FOUND);
    }
    return servicio;
  }

  private validarAcceso(
    servicio: ServicioTecnologico,
    usuario: AuthenticatedUser,
  ): void {
    if (
      servicio.idSolicitante !== usuario.id &&
      !this.esLaboratoristaOAdmin(usuario)
    ) {
      throw new HttpException(
        'No tienes acceso a este servicio',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  async create(
    dto: CreateServicioTecnologicoDto,
    solicitante: AuthenticatedUser,
  ): Promise<ServicioTecnologico> {
    // Mismas validaciones de laboratorio que el flujo estándar
    // (SolicitudesService.create): debe existir, estar activo, y aquí además
    // estar en modo fabricación digital.
    const laboratorio = await this.laboratoriosService.findOne(
      dto.idLaboratorio,
    );
    if (laboratorio.estado === EstadoLaboratorio.INACTIVO) {
      throw new HttpException(
        'El laboratorio está inactivo',
        HttpStatus.CONFLICT,
      );
    }
    if (
      laboratorio.modoReserva !==
      ModoReservaLaboratorio.LABORATORIO_COMO_SERVICIO
    ) {
      throw new HttpException(
        'Este laboratorio no admite servicios técnicos (no está en modo laboratorio como servicio)',
        HttpStatus.BAD_REQUEST,
      );
    }

    const servicioCatalogo = await this.serviciosService.findOne(
      dto.idServicioSolicitado,
    );
    if (servicioCatalogo.idLaboratorio !== dto.idLaboratorio) {
      throw new HttpException(
        'El servicio elegido no pertenece a este laboratorio',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (servicioCatalogo.estado === EstadoServicio.INACTIVO) {
      throw new HttpException(
        'Este servicio ya no está disponible',
        HttpStatus.CONFLICT,
      );
    }

    if (dto.idEquipoSugerido) {
      const equipoSugerido = await this.equiposLaboratorioService.findOne(
        dto.idEquipoSugerido,
      );
      if (equipoSugerido.idLaboratorio !== dto.idLaboratorio) {
        throw new HttpException(
          'El equipo sugerido no pertenece a este laboratorio',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const servicio = this.servicioRepository.create({
      idSolicitante: solicitante.id,
      idLaboratorio: dto.idLaboratorio,
      idServicioSolicitado: dto.idServicioSolicitado,
      descripcion: dto.descripcion,
      idEquipoSugerido: dto.idEquipoSugerido ?? null,
      estado: EstadoServicioTecnologico.SOLICITADO,
    });
    const creado = await this.servicioRepository.save(servicio);

    const laboratoristas = await this.todosLosLaboratoristas();
    await this.notificacionesService.notificarGenerico(
      TipoEventoNotificacion.SERVICIO_SOLICITADO,
      { idServicio: creado.idServicio },
      laboratoristas,
      `Servicio técnico #${creado.idServicio}`,
      [
        { etiqueta: 'Laboratorio', valor: laboratorio.nombre },
        { etiqueta: 'Servicio', valor: servicioCatalogo.nombre },
      ],
    );

    return creado;
  }

  /** Bandeja compartida: laboratorista/admin ven TODOS los servicios (para
   * poder atenderlos), el resto solo los propios. No filtra por archivada —
   * la Bandeja nunca muestra rechazado/cancelado igual, no le afecta. */
  async findAll(
    filtros: FiltrosServicios,
    usuario: AuthenticatedUser,
  ): Promise<ServicioTecnologico[]> {
    return this.servicioRepository.find({
      where: {
        ...(filtros.estado && { estado: filtros.estado }),
        ...(!this.esLaboratoristaOAdmin(usuario) && {
          idSolicitante: usuario.id,
        }),
      },
      relations: { cotizacion: { equipos: true }, servicioSolicitado: true },
      order: { fechaCreacion: 'DESC' },
    });
  }

  /** "Mis solicitudes": SIEMPRE lo propio, sin importar el rol — a
   * diferencia de findAll (bandeja compartida), aquí ni laboratorista ni
   * admin ven lo de otros. Mismo criterio que SolicitudesService.findMias. */
  /** Modo dual: ver comentario equivalente en SolicitudesService.findMias. */
  findMias(
    usuario: AuthenticatedUser,
    archivadas?: boolean,
  ): Promise<ServicioTecnologico[]>;
  findMias(
    usuario: AuthenticatedUser,
    archivadas: boolean,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<ServicioTecnologico>>;
  async findMias(
    usuario: AuthenticatedUser,
    archivadas = false,
    pagination?: PaginationParams,
  ): Promise<ServicioTecnologico[] | PaginatedResult<ServicioTecnologico>> {
    const where = {
      idSolicitante: usuario.id,
      archivada: archivadas,
      eliminada: false,
    };
    const relations = {
      cotizacion: { equipos: true },
      servicioSolicitado: true,
    };
    const order = { fechaCreacion: 'DESC' as const };

    if (!pagination) {
      return this.servicioRepository.find({ where, relations, order });
    }

    const [data, total] = await this.servicioRepository.findAndCount({
      where,
      relations,
      order,
      skip: pagination.skip,
      take: pagination.take,
    });
    return buildPaginatedResult(data, total, pagination.page, pagination.limit);
  }

  /** Solo el solicitante, y solo si ya quedó resuelto (rechazado/cancelado)
   * — no lo borra, solo desaparece de su propio findAll (ver
   * SolicitudesService.archivar, mismo criterio). */
  async archivar(
    id: number,
    usuario: AuthenticatedUser,
  ): Promise<ServicioTecnologico> {
    const servicio = await this.findConCotizacion(id);
    if (servicio.idSolicitante !== usuario.id) {
      throw new HttpException(
        'Solo el solicitante puede archivar su servicio',
        HttpStatus.FORBIDDEN,
      );
    }
    const ESTADOS_ARCHIVABLES = [
      EstadoServicioTecnologico.RECHAZADO,
      EstadoServicioTecnologico.CANCELADO,
    ];
    if (!ESTADOS_ARCHIVABLES.includes(servicio.estado)) {
      throw new HttpException(
        `No se puede archivar un servicio en estado "${servicio.estado}"`,
        HttpStatus.CONFLICT,
      );
    }
    await this.servicioRepository.update(
      { idServicio: id },
      { archivada: true },
    );
    return this.findConCotizacion(id);
  }

  async desarchivar(
    id: number,
    usuario: AuthenticatedUser,
  ): Promise<ServicioTecnologico> {
    const servicio = await this.findConCotizacion(id);
    if (servicio.idSolicitante !== usuario.id) {
      throw new HttpException(
        'Solo el solicitante puede restaurar su servicio',
        HttpStatus.FORBIDDEN,
      );
    }
    await this.servicioRepository.update(
      { idServicio: id },
      { archivada: false },
    );
    return this.findConCotizacion(id);
  }

  /** Soft delete de TODOS los servicios archivados del usuario — mismo
   * criterio que SolicitudesService.vaciarArchivadas: no borra nada, solo
   * los saca de Mis Solicitudes para siempre. La fila, la cotización y el
   * archivo adjunto quedan intactos. */
  async vaciarArchivados(usuario: AuthenticatedUser): Promise<number> {
    const resultado = await this.servicioRepository.update(
      { idSolicitante: usuario.id, archivada: true },
      { eliminada: true },
    );
    return resultado.affected ?? 0;
  }

  async findOne(
    id: number,
    usuario: AuthenticatedUser,
  ): Promise<ServicioTecnologico> {
    const servicio = await this.findConCotizacion(id);
    this.validarAcceso(servicio, usuario);
    return servicio;
  }

  // ───────────────────────── archivo adjunto ─────────────────────────

  private rutaEnDisco(nombreArchivo: string): string {
    return join(UPLOADS_ROOT, CARPETA_ARCHIVO, nombreArchivo);
  }

  private validarArchivoEditable(servicio: ServicioTecnologico): void {
    if (!archivoEsEditableEnEstado(servicio.estado)) {
      throw new HttpException(
        `El archivo ya no se puede modificar en estado "${servicio.estado}"`,
        HttpStatus.CONFLICT,
      );
    }
  }

  async subirArchivo(
    id: number,
    usuario: AuthenticatedUser,
    archivo: Express.Multer.File,
  ): Promise<ServicioTecnologico> {
    const servicio = await this.findOne(id, usuario);
    if (servicio.idSolicitante !== usuario.id) {
      throw new HttpException(
        'Solo el solicitante puede subir el archivo',
        HttpStatus.FORBIDDEN,
      );
    }
    this.validarArchivoEditable(servicio);

    if (servicio.archivoRuta) {
      const rutaAnterior = this.rutaEnDisco(servicio.archivoRuta);
      if (existsSync(rutaAnterior)) {
        unlinkSync(rutaAnterior);
      }
    }

    await this.servicioRepository.update(
      { idServicio: id },
      {
        archivoRuta: archivo.filename,
        archivoNombreOriginal: archivo.originalname,
      },
    );
    return this.findConCotizacion(id);
  }

  async eliminarArchivo(
    id: number,
    usuario: AuthenticatedUser,
  ): Promise<ServicioTecnologico> {
    const servicio = await this.findOne(id, usuario);
    if (servicio.idSolicitante !== usuario.id) {
      throw new HttpException(
        'Solo el solicitante puede eliminar el archivo',
        HttpStatus.FORBIDDEN,
      );
    }
    this.validarArchivoEditable(servicio);

    if (servicio.archivoRuta) {
      const ruta = this.rutaEnDisco(servicio.archivoRuta);
      if (existsSync(ruta)) {
        unlinkSync(ruta);
      }
    }
    await this.servicioRepository.update(
      { idServicio: id },
      { archivoRuta: null, archivoNombreOriginal: null },
    );
    return this.findConCotizacion(id);
  }

  async obtenerArchivo(
    id: number,
    usuario: AuthenticatedUser,
  ): Promise<{ ruta: string; nombreOriginal: string }> {
    const servicio = await this.findOne(id, usuario);
    if (!servicio.archivoRuta) {
      throw new HttpException(
        'Este servicio no tiene archivo adjunto',
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      ruta: this.rutaEnDisco(servicio.archivoRuta),
      nombreOriginal: servicio.archivoNombreOriginal!,
    };
  }

  // ───────────────────────── máquina de estados ─────────────────────────

  private validarEstado(
    servicio: ServicioTecnologico,
    esperados: EstadoServicioTecnologico[],
  ): void {
    if (!esperados.includes(servicio.estado)) {
      throw new HttpException(
        `El servicio está en estado "${servicio.estado}", se esperaba: ${esperados.join(', ')}`,
        HttpStatus.CONFLICT,
      );
    }
  }

  /** Revisión técnica + cotización en un solo acto (ver decisión de negocio:
   * el técnico revisa viabilidad y cotiza al mismo tiempo). */
  async cotizar(
    id: number,
    dto: CotizarServicioDto,
    tecnico: AuthenticatedUser,
  ): Promise<ServicioTecnologico> {
    const servicio = await this.findConCotizacion(id);
    this.validarEstado(servicio, [
      EstadoServicioTecnologico.SOLICITADO,
      EstadoServicioTecnologico.EN_REVISION,
    ]);

    for (const idEquipo of dto.idsEquipos) {
      const equipo =
        await this.equiposLaboratorioService.validarDisponibleParaProgramar(
          idEquipo,
        );
      if (equipo.idLaboratorio !== servicio.idLaboratorio) {
        throw new HttpException(
          `El equipo ${idEquipo} no pertenece al laboratorio de este servicio`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const costoMaterial = dto.costoMaterial;
    const costoTiempoUso = dto.costoTiempoUso;
    const costoEnergia = dto.costoEnergia;
    const costoManoObra = dto.costoManoObra;
    const costosAdicionales = dto.costosAdicionales ?? 0;
    const margen = dto.margen ?? 0;
    const total =
      costoMaterial +
      costoTiempoUso +
      costoEnergia +
      costoManoObra +
      costosAdicionales +
      margen;

    await this.dataSource.transaction(async (manager) => {
      const cotizacionRepo = manager.getRepository(CotizacionServicio);
      const cotizacionEquipoRepo = manager.getRepository(CotizacionEquipo);
      const servicioRepo = manager.getRepository(ServicioTecnologico);

      const cotizacion = await cotizacionRepo.save(
        cotizacionRepo.create({
          idServicio: servicio.idServicio,
          idCotizadoPor: tecnico.id,
          descripcionMaterial: dto.descripcionMaterial ?? null,
          costoMaterial: costoMaterial.toFixed(2),
          costoTiempoUso: costoTiempoUso.toFixed(2),
          costoEnergia: costoEnergia.toFixed(2),
          costoManoObra: costoManoObra.toFixed(2),
          costosAdicionales: costosAdicionales.toFixed(2),
          margen: margen.toFixed(2),
          total: total.toFixed(2),
        }),
      );

      await cotizacionEquipoRepo.save(
        dto.idsEquipos.map((idEquipo) =>
          cotizacionEquipoRepo.create({
            idCotizacion: cotizacion.idCotizacion,
            idEquipo,
          }),
        ),
      );

      await servicioRepo.update(
        { idServicio: servicio.idServicio },
        { estado: EstadoServicioTecnologico.COTIZADO },
      );
    });

    const destinatario = await this.destinatarioSolicitante(
      servicio.idSolicitante,
    );
    await this.notificacionesService.notificarGenerico(
      TipoEventoNotificacion.SERVICIO_COTIZADO,
      { idServicio: id },
      destinatario,
      `Servicio técnico #${id}`,
      [{ etiqueta: 'Total cotizado', valor: total.toFixed(2) }],
    );

    return this.findConCotizacion(id);
  }

  async responderCotizacion(
    id: number,
    dto: ResponderCotizacionDto,
    usuario: AuthenticatedUser,
  ): Promise<ServicioTecnologico> {
    const servicio = await this.findConCotizacion(id);
    if (servicio.idSolicitante !== usuario.id) {
      throw new HttpException(
        'Solo el solicitante puede responder la cotización',
        HttpStatus.FORBIDDEN,
      );
    }
    this.validarEstado(servicio, [EstadoServicioTecnologico.COTIZADO]);

    await this.servicioRepository.update(
      { idServicio: id },
      dto.aprobar
        ? { estado: EstadoServicioTecnologico.APROBADO }
        : {
            estado: EstadoServicioTecnologico.RECHAZADO,
            motivoRechazo: dto.motivoRechazo,
          },
    );

    const laboratoristas = await this.todosLosLaboratoristas();
    await this.notificacionesService.notificarGenerico(
      dto.aprobar
        ? TipoEventoNotificacion.SERVICIO_APROBADO
        : TipoEventoNotificacion.SERVICIO_RECHAZADO,
      { idServicio: id },
      laboratoristas,
      `Servicio técnico #${id}`,
      [],
      dto.aprobar ? undefined : dto.motivoRechazo,
    );

    return this.findConCotizacion(id);
  }

  /** Cruza contra HorarioAcademico (clase fija), otros servicios ya
   * programados/en proceso sobre el mismo equipo, y eventos especiales
   * aprobados (total, o parcial que incluya este equipo) — sin esto, nada
   * impedía programar dos servicios en el mismo equipo a la misma hora. */
  private async verificarDisponibilidadParaProgramar(
    idLaboratorio: number,
    idEquipo: number,
    fecha: string,
    horaInicio: string,
    horaFin: string,
  ): Promise<{ disponible: boolean; motivo?: string }> {
    const diaSemana = diaSemanaDeFecha(fecha);
    const horarios = await this.horarioAcademicoRepository
      .createQueryBuilder('horario')
      .innerJoin(
        'periodo_academico',
        'periodo',
        'periodo.id_periodo = horario.id_periodo',
      )
      .where('horario.id_laboratorio = :idLaboratorio', { idLaboratorio })
      .andWhere('horario.dia_semana = :diaSemana', { diaSemana })
      .andWhere('horario.estado = :estado', { estado: EstadoHorario.VIGENTE })
      .andWhere('periodo.fecha_inicio <= :fecha', { fecha })
      .andWhere('periodo.fecha_fin >= :fecha', { fecha })
      .getMany();
    if (
      horarios.some((h) =>
        horasCruzan(horaInicio, horaFin, h.horaInicio, h.horaFin),
      )
    ) {
      return {
        disponible: false,
        motivo: 'Cruza con un horario académico programado',
      };
    }

    const filasProgramadas = await this.cotizacionEquipoRepository
      .createQueryBuilder('ce')
      .innerJoin(
        'cotizacion_servicio',
        'cotizacion',
        'cotizacion.id_cotizacion = ce.id_cotizacion',
      )
      .innerJoin(
        'servicio_tecnologico',
        'servicio',
        'servicio.id_servicio = cotizacion.id_servicio',
      )
      .where('ce.id_equipo = :idEquipo', { idEquipo })
      .andWhere('ce.fecha_programada = :fecha', { fecha })
      .andWhere('servicio.estado IN (:...estados)', {
        estados: [
          EstadoServicioTecnologico.PROGRAMADO,
          EstadoServicioTecnologico.EN_PROCESO,
        ],
      })
      .getMany();
    if (
      filasProgramadas.some(
        (f) =>
          f.horaInicioProgramada &&
          f.horaFinProgramada &&
          horasCruzan(
            horaInicio,
            horaFin,
            f.horaInicioProgramada,
            f.horaFinProgramada,
          ),
      )
    ) {
      return {
        disponible: false,
        motivo: 'Este equipo ya tiene otro servicio programado en ese horario',
      };
    }

    const eventos = await this.eventoLaboratorioRepository
      .createQueryBuilder('evento')
      .leftJoinAndSelect('evento.equipos', 'equipos')
      .where('evento.id_laboratorio = :idLaboratorio', { idLaboratorio })
      .andWhere('evento.fecha = :fecha', { fecha })
      .andWhere('evento.estado = :estado', { estado: EstadoEvento.APROBADO })
      .getMany();
    const eventoQueCruza = eventos.find((e) =>
      horasCruzan(horaInicio, horaFin, e.horaInicio, e.horaFin),
    );
    if (eventoQueCruza) {
      const bloquea =
        eventoQueCruza.modalidad === ModalidadEvento.TOTAL ||
        eventoQueCruza.equipos.some((ee) => ee.idEquipo === idEquipo);
      if (bloquea) {
        return {
          disponible: false,
          motivo:
            'Ya existe un evento especial aprobado que ocupa este equipo en ese horario',
        };
      }
    }

    return { disponible: true };
  }

  async programar(
    id: number,
    dto: ProgramarServicioDto,
    usuario: AuthenticatedUser,
  ): Promise<ServicioTecnologico> {
    const servicio = await this.findConCotizacion(id);
    this.validarEstado(servicio, [EstadoServicioTecnologico.APROBADO]);

    const equiposCotizados = servicio.cotizacion!.equipos.map(
      (ce) => ce.idEquipo,
    );
    for (const item of dto.equipos) {
      if (!equiposCotizados.includes(item.idEquipo)) {
        throw new HttpException(
          `El equipo ${item.idEquipo} no forma parte de la cotización de este servicio`,
          HttpStatus.BAD_REQUEST,
        );
      }
      if (item.horaFin <= item.horaInicio) {
        throw new HttpException(
          'La hora de fin debe ser posterior a la hora de inicio',
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.equiposLaboratorioService.validarDisponibleParaProgramar(
        item.idEquipo,
      );
      const disponibilidad = await this.verificarDisponibilidadParaProgramar(
        servicio.idLaboratorio,
        item.idEquipo,
        item.fecha,
        item.horaInicio,
        item.horaFin,
      );
      if (!disponibilidad.disponible) {
        throw new HttpException(
          `Sin disponibilidad para el equipo ${item.idEquipo}: ${disponibilidad.motivo}`,
          HttpStatus.CONFLICT,
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      const cotizacionEquipoRepo = manager.getRepository(CotizacionEquipo);
      const servicioRepo = manager.getRepository(ServicioTecnologico);

      for (const item of dto.equipos) {
        const fila = servicio.cotizacion!.equipos.find(
          (ce) => ce.idEquipo === item.idEquipo,
        )!;
        await cotizacionEquipoRepo.update(
          { idCotizacionEquipo: fila.idCotizacionEquipo },
          {
            fechaProgramada: item.fecha,
            horaInicioProgramada: item.horaInicio,
            horaFinProgramada: item.horaFin,
            idProgramadoPor: usuario.id,
          },
        );
      }

      await servicioRepo.update(
        { idServicio: servicio.idServicio },
        { estado: EstadoServicioTecnologico.PROGRAMADO },
      );
    });

    const destinatario = await this.destinatarioSolicitante(
      servicio.idSolicitante,
    );
    await this.notificacionesService.notificarGenerico(
      TipoEventoNotificacion.SERVICIO_PROGRAMADO,
      { idServicio: id },
      destinatario,
      `Servicio técnico #${id}`,
      [],
    );

    return this.findConCotizacion(id);
  }

  private obtenerFilaCotizacionEquipo(
    servicio: ServicioTecnologico,
    idEquipo: number,
  ): CotizacionEquipo {
    const fila = servicio.cotizacion?.equipos.find(
      (ce) => ce.idEquipo === idEquipo,
    );
    if (!fila) {
      throw new HttpException(
        `El equipo ${idEquipo} no forma parte de la cotización de este servicio`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return fila;
  }

  async iniciarEquipo(
    id: number,
    idEquipo: number,
    usuario: AuthenticatedUser,
  ): Promise<ServicioTecnologico> {
    const servicio = await this.findConCotizacion(id);
    this.validarEstado(servicio, [
      EstadoServicioTecnologico.PROGRAMADO,
      EstadoServicioTecnologico.EN_PROCESO,
    ]);

    const fila = this.obtenerFilaCotizacionEquipo(servicio, idEquipo);
    if (fila.horaInicioReal) {
      throw new HttpException(
        'Este equipo ya fue marcado como iniciado',
        HttpStatus.CONFLICT,
      );
    }

    await this.cotizacionEquipoRepository.update(
      { idCotizacionEquipo: fila.idCotizacionEquipo },
      { horaInicioReal: new Date(), idIniciadoPor: usuario.id },
    );

    if (servicio.estado === EstadoServicioTecnologico.PROGRAMADO) {
      await this.servicioRepository.update(
        { idServicio: id },
        { estado: EstadoServicioTecnologico.EN_PROCESO },
      );
    }
    return this.findConCotizacion(id);
  }

  async finalizarEquipo(
    id: number,
    idEquipo: number,
    usuario: AuthenticatedUser,
  ): Promise<ServicioTecnologico> {
    const servicio = await this.findConCotizacion(id);
    this.validarEstado(servicio, [EstadoServicioTecnologico.EN_PROCESO]);

    const fila = this.obtenerFilaCotizacionEquipo(servicio, idEquipo);
    if (!fila.horaInicioReal) {
      throw new HttpException(
        'Este equipo todavía no fue marcado como iniciado',
        HttpStatus.CONFLICT,
      );
    }
    if (fila.horaFinReal) {
      throw new HttpException(
        'Este equipo ya fue marcado como finalizado',
        HttpStatus.CONFLICT,
      );
    }

    await this.cotizacionEquipoRepository.update(
      { idCotizacionEquipo: fila.idCotizacionEquipo },
      { horaFinReal: new Date(), idFinalizadoPor: usuario.id },
    );

    const todosFinalizados = servicio.cotizacion!.equipos.every(
      (ce) => ce.idEquipo === idEquipo || ce.horaFinReal,
    );
    if (todosFinalizados) {
      await this.servicioRepository.update(
        { idServicio: id },
        { estado: EstadoServicioTecnologico.FINALIZADO },
      );
    }
    return this.findConCotizacion(id);
  }

  /** "Entregado" cierra el servicio — ver decisión de negocio: no hay un
   * estado de "Cierre" aparte, la entrega ya es el cierre. */
  async entregar(
    id: number,
    usuario: AuthenticatedUser,
  ): Promise<ServicioTecnologico> {
    const servicio = await this.findConCotizacion(id);
    this.validarEstado(servicio, [EstadoServicioTecnologico.FINALIZADO]);
    await this.servicioRepository.update(
      { idServicio: id },
      {
        estado: EstadoServicioTecnologico.ENTREGADO,
        idEntregadoPor: usuario.id,
        fechaEntrega: new Date(),
      },
    );

    const destinatario = await this.destinatarioSolicitante(
      servicio.idSolicitante,
    );
    await this.notificacionesService.notificarGenerico(
      TipoEventoNotificacion.SERVICIO_ENTREGADO,
      { idServicio: id },
      destinatario,
      `Servicio técnico #${id}`,
      [],
    );

    return this.findConCotizacion(id);
  }

  async cancelar(
    id: number,
    dto: CancelarServicioDto,
    usuario: AuthenticatedUser,
  ): Promise<ServicioTecnologico> {
    const servicio = await this.findConCotizacion(id);
    if (servicio.idSolicitante !== usuario.id && usuario.rol !== 'admin') {
      throw new HttpException(
        'Solo el solicitante o un admin pueden cancelar',
        HttpStatus.FORBIDDEN,
      );
    }

    const ESTADOS_TERMINALES = [
      EstadoServicioTecnologico.ENTREGADO,
      EstadoServicioTecnologico.RECHAZADO,
      EstadoServicioTecnologico.CANCELADO,
    ];
    if (ESTADOS_TERMINALES.includes(servicio.estado)) {
      throw new HttpException(
        `No se puede cancelar en estado "${servicio.estado}"`,
        HttpStatus.CONFLICT,
      );
    }

    await this.servicioRepository.update(
      { idServicio: id },
      {
        estado: EstadoServicioTecnologico.CANCELADO,
        motivoCancelacion: dto.motivo,
      },
    );

    const laboratoristas = await this.todosLosLaboratoristas();
    await this.notificacionesService.notificarGenerico(
      TipoEventoNotificacion.SERVICIO_CANCELADO,
      { idServicio: id },
      laboratoristas,
      `Servicio técnico #${id}`,
      [],
      dto.motivo,
    );

    return this.findConCotizacion(id);
  }
}
