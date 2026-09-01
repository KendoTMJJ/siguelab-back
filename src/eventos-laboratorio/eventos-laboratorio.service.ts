import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import type { AuthenticatedUser } from 'src/auth/decorators/current-user.decorator';
import { LaboratoriosService } from 'src/laboratorios/services/laboratorios.service';
import { EquiposLaboratorioService } from 'src/equipos-laboratorio/equipos-laboratorio.service';
import { Equipo } from 'src/equipos-laboratorio/entities/equipo.entity';
import {
  EstadoLaboratorio,
  ModoReservaLaboratorio,
} from 'src/laboratorios/entities/laboratorio.entity';
import {
  HorarioAcademico,
  EstadoHorario,
} from 'src/horarios-academicos/entities/horario-academico.entity';
import { EstadoServicioTecnologico } from 'src/servicios-tecnologicos/entities/servicio-tecnologico.entity';
import { CotizacionEquipo } from 'src/servicios-tecnologicos/entities/cotizacion-equipo.entity';
import { Usuario, EstadoUsuario } from 'src/usuarios/entities/usuario.entity';
import { Rol } from 'src/roles/entities/rol.entity';
import { NotificacionesService } from 'src/notificaciones/notificaciones.service';
import { TipoEventoNotificacion } from 'src/notificaciones/entities/notificacion.entity';
import {
  diaSemanaDeFecha,
  horasCruzan,
} from 'src/common/utils/fecha-horario.util';
import {
  EventoLaboratorio,
  EstadoEvento,
  ModalidadEvento,
} from './entities/evento-laboratorio.entity';
import { EventoEquipo } from './entities/evento-equipo.entity';
import { CreateEventoLaboratorioDto } from './dto/create-evento-laboratorio.dto';
import { RechazarEventoDto } from './dto/rechazar-evento.dto';
import { CancelarEventoDto } from './dto/cancelar-evento.dto';

export interface FiltrosEventos {
  estado?: EstadoEvento;
}

interface ParametrosDisponibilidad {
  idLaboratorio: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  modalidad: ModalidadEvento;
  idsEquipos: number[];
  idEventoExcluir?: number;
}

@Injectable()
export class EventosLaboratorioService {
  private readonly eventoRepository: Repository<EventoLaboratorio>;
  private readonly eventoEquipoRepository: Repository<EventoEquipo>;
  private readonly equipoRepository: Repository<Equipo>;
  private readonly horarioAcademicoRepository: Repository<HorarioAcademico>;
  private readonly cotizacionEquipoRepository: Repository<CotizacionEquipo>;
  private readonly usuarioRepository: Repository<Usuario>;
  private readonly rolRepository: Repository<Rol>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly laboratoriosService: LaboratoriosService,
    private readonly equiposLaboratorioService: EquiposLaboratorioService,
    private readonly notificacionesService: NotificacionesService,
  ) {
    this.eventoRepository = this.dataSource.getRepository(EventoLaboratorio);
    this.eventoEquipoRepository = this.dataSource.getRepository(EventoEquipo);
    this.equipoRepository = this.dataSource.getRepository(Equipo);
    this.horarioAcademicoRepository =
      this.dataSource.getRepository(HorarioAcademico);
    this.cotizacionEquipoRepository =
      this.dataSource.getRepository(CotizacionEquipo);
    this.usuarioRepository = this.dataSource.getRepository(Usuario);
    this.rolRepository = this.dataSource.getRepository(Rol);
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

  private async findConEquipos(id: number): Promise<EventoLaboratorio> {
    const evento = await this.eventoRepository.findOne({
      where: { idEvento: id },
      relations: { equipos: true },
    });
    if (!evento) {
      throw new HttpException('Evento no encontrado', HttpStatus.NOT_FOUND);
    }
    return evento;
  }

  private async horarioAcademicoCruza(
    idLaboratorio: number,
    fecha: string,
    horaInicio: string,
    horaFin: string,
  ): Promise<boolean> {
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

    return horarios.some((h) =>
      horasCruzan(horaInicio, horaFin, h.horaInicio, h.horaFin),
    );
  }

  private async eventosAprobadosQueCruzan(
    idLaboratorio: number,
    fecha: string,
    horaInicio: string,
    horaFin: string,
    idEventoExcluir?: number,
  ): Promise<EventoLaboratorio[]> {
    const query = this.eventoRepository
      .createQueryBuilder('evento')
      .leftJoinAndSelect('evento.equipos', 'equipos')
      .where('evento.id_laboratorio = :idLaboratorio', { idLaboratorio })
      .andWhere('evento.fecha = :fecha', { fecha })
      .andWhere('evento.estado = :estado', { estado: EstadoEvento.APROBADO });

    if (idEventoExcluir) {
      query.andWhere('evento.id_evento != :idExcluir', {
        idExcluir: idEventoExcluir,
      });
    }

    const candidatos = await query.getMany();
    return candidatos.filter((e) =>
      horasCruzan(horaInicio, horaFin, e.horaInicio, e.horaFin),
    );
  }

  private async equiposProgramadosQueCruzan(
    idsEquipos: number[],
    fecha: string,
    horaInicio: string,
    horaFin: string,
  ): Promise<boolean> {
    if (idsEquipos.length === 0) {
      return false;
    }
    const filas = await this.cotizacionEquipoRepository
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
      .where('ce.id_equipo IN (:...idsEquipos)', { idsEquipos })
      .andWhere('ce.fecha_programada = :fecha', { fecha })
      .andWhere('servicio.estado IN (:...estados)', {
        estados: [
          EstadoServicioTecnologico.PROGRAMADO,
          EstadoServicioTecnologico.EN_PROCESO,
        ],
      })
      .getMany();

    return filas.some(
      (f) =>
        f.horaInicioProgramada &&
        f.horaFinProgramada &&
        horasCruzan(
          horaInicio,
          horaFin,
          f.horaInicioProgramada,
          f.horaFinProgramada,
        ),
    );
  }

  private async verificarDisponibilidad(
    params: ParametrosDisponibilidad,
  ): Promise<{ disponible: boolean; motivo?: string }> {
    const cruzaHorario = await this.horarioAcademicoCruza(
      params.idLaboratorio,
      params.fecha,
      params.horaInicio,
      params.horaFin,
    );
    if (cruzaHorario) {
      return {
        disponible: false,
        motivo: 'Cruza con un horario académico programado',
      };
    }

    const eventosQueCruzan = await this.eventosAprobadosQueCruzan(
      params.idLaboratorio,
      params.fecha,
      params.horaInicio,
      params.horaFin,
      params.idEventoExcluir,
    );

    if (
      params.modalidad === ModalidadEvento.TOTAL &&
      eventosQueCruzan.length > 0
    ) {
      return {
        disponible: false,
        motivo: 'Ya existe un evento aprobado que cruza en ese horario',
      };
    }

    const hayEventoTotalQueCruza = eventosQueCruzan.some(
      (e) => e.modalidad === ModalidadEvento.TOTAL,
    );
    if (hayEventoTotalQueCruza) {
      return {
        disponible: false,
        motivo: 'Ya existe un evento total aprobado que cruza en ese horario',
      };
    }

    if (params.modalidad === ModalidadEvento.PARCIAL) {
      const hayConflictoDeEquipo = eventosQueCruzan.some((e) =>
        e.equipos.some((ee) => params.idsEquipos.includes(ee.idEquipo)),
      );
      if (hayConflictoDeEquipo) {
        return {
          disponible: false,
          motivo:
            'Alguno de los equipos ya está reservado por otro evento aprobado en ese horario',
        };
      }
    }

    const equiposATestear =
      params.modalidad === ModalidadEvento.TOTAL
        ? (
            await this.equipoRepository.find({
              where: { idLaboratorio: params.idLaboratorio },
            })
          ).map((e) => e.idEquipo)
        : params.idsEquipos;

    const hayServicioQueCruza = await this.equiposProgramadosQueCruzan(
      equiposATestear,
      params.fecha,
      params.horaInicio,
      params.horaFin,
    );
    if (hayServicioQueCruza) {
      return {
        disponible: false,
        motivo:
          'Alguno de los equipos ya tiene un servicio tecnológico programado en ese horario',
      };
    }

    return { disponible: true };
  }

  async create(
    dto: CreateEventoLaboratorioDto,
    solicitante: AuthenticatedUser,
  ): Promise<EventoLaboratorio> {
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
        'Este laboratorio no admite eventos especiales (no está en modo laboratorio como servicio)',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.horaFin <= dto.horaInicio) {
      throw new HttpException(
        'La hora de fin debe ser posterior a la hora de inicio',
        HttpStatus.BAD_REQUEST,
      );
    }

    const idsEquipos =
      dto.modalidad === ModalidadEvento.PARCIAL ? dto.idsEquipos! : [];
    for (const idEquipo of idsEquipos) {
      const equipo = await this.equiposLaboratorioService.findOne(idEquipo);
      if (equipo.idLaboratorio !== dto.idLaboratorio) {
        throw new HttpException(
          `El equipo ${idEquipo} no pertenece a este laboratorio`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const disponibilidad = await this.verificarDisponibilidad({
      idLaboratorio: dto.idLaboratorio,
      fecha: dto.fecha,
      horaInicio: dto.horaInicio,
      horaFin: dto.horaFin,
      modalidad: dto.modalidad,
      idsEquipos,
    });
    if (!disponibilidad.disponible) {
      throw new HttpException(
        `Sin disponibilidad: ${disponibilidad.motivo}`,
        HttpStatus.CONFLICT,
      );
    }

    const evento = await this.dataSource.transaction(async (manager) => {
      const eventoRepo = manager.getRepository(EventoLaboratorio);
      const eventoEquipoRepo = manager.getRepository(EventoEquipo);

      const creado = await eventoRepo.save(
        eventoRepo.create({
          idLaboratorio: dto.idLaboratorio,
          idSolicitante: solicitante.id,
          responsable: dto.responsable,
          dependenciaSolicitante: dto.dependenciaSolicitante,
          fecha: dto.fecha,
          horaInicio: dto.horaInicio,
          horaFin: dto.horaFin,
          numAsistentes: dto.numAsistentes,
          prioridad: dto.prioridad,
          observaciones: dto.observaciones ?? null,
          modalidad: dto.modalidad,
          estado: EstadoEvento.SOLICITADO,
        }),
      );

      if (idsEquipos.length > 0) {
        await eventoEquipoRepo.save(
          idsEquipos.map((idEquipo) =>
            eventoEquipoRepo.create({ idEvento: creado.idEvento, idEquipo }),
          ),
        );
      }
      return creado;
    });

    const laboratoristas = await this.todosLosLaboratoristas();
    await this.notificacionesService.notificarGenerico(
      TipoEventoNotificacion.EVENTO_SOLICITADO,
      { idEvento: evento.idEvento },
      laboratoristas,
      `Evento especial #${evento.idEvento}`,
      [
        { etiqueta: 'Laboratorio', valor: laboratorio.nombre },
        { etiqueta: 'Fecha', valor: dto.fecha },
      ],
    );

    return this.findConEquipos(evento.idEvento);
  }

  private esLaboratoristaOAdmin(usuario: AuthenticatedUser): boolean {
    return usuario.rol === 'laboratorista' || usuario.rol === 'admin';
  }

  /** Mismo criterio de privacidad que ServiciosTecnologicosService: el
   * solicitante ve solo lo suyo, laboratorista/admin ven todo. */
  async findAll(
    filtros: FiltrosEventos,
    usuario: AuthenticatedUser,
  ): Promise<EventoLaboratorio[]> {
    const esPropio = !this.esLaboratoristaOAdmin(usuario);
    return this.eventoRepository.find({
      where: {
        ...(filtros.estado && { estado: filtros.estado }),
        ...(esPropio && { idSolicitante: usuario.id, archivada: false }),
      },
      relations: { equipos: true },
      order: { fecha: 'DESC', horaInicio: 'ASC' },
    });
  }

  /** Solo el solicitante, y solo si ya quedó resuelto (rechazado/cancelado)
   * — mismo criterio que SolicitudesService.archivar. */
  async archivar(
    id: number,
    usuario: AuthenticatedUser,
  ): Promise<EventoLaboratorio> {
    const evento = await this.findConEquipos(id);
    if (evento.idSolicitante !== usuario.id) {
      throw new HttpException(
        'Solo el solicitante puede archivar su evento',
        HttpStatus.FORBIDDEN,
      );
    }
    const ESTADOS_ARCHIVABLES = [
      EstadoEvento.RECHAZADO,
      EstadoEvento.CANCELADO,
    ];
    if (!ESTADOS_ARCHIVABLES.includes(evento.estado)) {
      throw new HttpException(
        `No se puede archivar un evento en estado "${evento.estado}"`,
        HttpStatus.CONFLICT,
      );
    }
    await this.eventoRepository.update({ idEvento: id }, { archivada: true });
    return this.findConEquipos(id);
  }

  async findOne(
    id: number,
    usuario: AuthenticatedUser,
  ): Promise<EventoLaboratorio> {
    const evento = await this.findConEquipos(id);
    if (
      evento.idSolicitante !== usuario.id &&
      !this.esLaboratoristaOAdmin(usuario)
    ) {
      throw new HttpException(
        'No tienes acceso a este evento',
        HttpStatus.FORBIDDEN,
      );
    }
    return evento;
  }

  /** Re-verifica disponibilidad al aprobar: pudo haberse aprobado otro
   * evento/servicio en conflicto mientras este seguía "solicitado". */
  async aprobar(
    id: number,
    usuario: AuthenticatedUser,
  ): Promise<EventoLaboratorio> {
    const evento = await this.findConEquipos(id);
    if (evento.estado !== EstadoEvento.SOLICITADO) {
      throw new HttpException(
        `El evento está en estado "${evento.estado}", no se puede aprobar`,
        HttpStatus.CONFLICT,
      );
    }

    const idsEquipos = evento.equipos.map((ee) => ee.idEquipo);
    const disponibilidad = await this.verificarDisponibilidad({
      idLaboratorio: evento.idLaboratorio,
      fecha: evento.fecha,
      horaInicio: evento.horaInicio,
      horaFin: evento.horaFin,
      modalidad: evento.modalidad,
      idsEquipos,
      idEventoExcluir: evento.idEvento,
    });
    if (!disponibilidad.disponible) {
      throw new HttpException(
        `Sin disponibilidad: ${disponibilidad.motivo}`,
        HttpStatus.CONFLICT,
      );
    }

    await this.eventoRepository.update(
      { idEvento: id },
      {
        estado: EstadoEvento.APROBADO,
        idAprobadoPor: usuario.id,
        fechaAprobacion: new Date(),
      },
    );

    const destinatarioAprobado = await this.destinatarioSolicitante(
      evento.idSolicitante,
    );
    await this.notificacionesService.notificarGenerico(
      TipoEventoNotificacion.EVENTO_APROBADO,
      { idEvento: id },
      destinatarioAprobado,
      `Evento especial #${id}`,
      [],
    );

    return this.findConEquipos(id);
  }

  async rechazar(
    id: number,
    dto: RechazarEventoDto,
  ): Promise<EventoLaboratorio> {
    const evento = await this.findConEquipos(id);
    if (evento.estado !== EstadoEvento.SOLICITADO) {
      throw new HttpException(
        `El evento está en estado "${evento.estado}", no se puede rechazar`,
        HttpStatus.CONFLICT,
      );
    }
    await this.eventoRepository.update(
      { idEvento: id },
      { estado: EstadoEvento.RECHAZADO, motivoRechazo: dto.motivo },
    );

    const destinatarioRechazado = await this.destinatarioSolicitante(
      evento.idSolicitante,
    );
    await this.notificacionesService.notificarGenerico(
      TipoEventoNotificacion.EVENTO_RECHAZADO,
      { idEvento: id },
      destinatarioRechazado,
      `Evento especial #${id}`,
      [],
      dto.motivo,
    );

    return this.findConEquipos(id);
  }

  async cancelar(
    id: number,
    dto: CancelarEventoDto,
    usuario: AuthenticatedUser,
  ): Promise<EventoLaboratorio> {
    const evento = await this.findConEquipos(id);
    if (evento.idSolicitante !== usuario.id && usuario.rol !== 'admin') {
      throw new HttpException(
        'Solo el solicitante o un admin pueden cancelar',
        HttpStatus.FORBIDDEN,
      );
    }
    if (
      evento.estado === EstadoEvento.RECHAZADO ||
      evento.estado === EstadoEvento.CANCELADO
    ) {
      throw new HttpException(
        `No se puede cancelar en estado "${evento.estado}"`,
        HttpStatus.CONFLICT,
      );
    }
    await this.eventoRepository.update(
      { idEvento: id },
      { estado: EstadoEvento.CANCELADO, motivoCancelacion: dto.motivo },
    );

    const laboratoristas = await this.todosLosLaboratoristas();
    await this.notificacionesService.notificarGenerico(
      TipoEventoNotificacion.EVENTO_CANCELADO,
      { idEvento: id },
      laboratoristas,
      `Evento especial #${id}`,
      [],
      dto.motivo,
    );

    return this.findConEquipos(id);
  }
}
