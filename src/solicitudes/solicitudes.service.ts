import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import type { AuthenticatedUser } from 'src/auth/decorators/current-user.decorator';
import {
  PaginatedResult,
  buildPaginatedResult,
} from 'src/common/pagination/paginated-result.interface';
import { PaginationParams } from 'src/common/pagination/pagination.util';
import { hoyBogota } from 'src/common/utils/fecha-horario.util';
import {
  Laboratorio,
  EstadoLaboratorio,
  ModoReservaLaboratorio,
} from 'src/laboratorios/entities/laboratorio.entity';
import { EspacioAcademico } from 'src/catalogos/entities/espacio-academico.entity';
import { EspacioLaboratorio } from 'src/laboratorios/entities/espacio-laboratorio.entity';
import { DocenteLaboratorio } from 'src/laboratorios/entities/docente-laboratorio.entity';
import { TipoReserva } from 'src/catalogos/entities/tipo-reserva.entity';
import { PeriodoAcademico } from 'src/catalogos/entities/periodo-academico.entity';
import { Facultad } from 'src/catalogos/entities/facultad.entity';
import { Usuario, EstadoUsuario } from 'src/usuarios/entities/usuario.entity';
import {
  HorarioAcademico,
  EstadoHorario,
  DiaSemana,
} from 'src/horarios-academicos/entities/horario-academico.entity';
import { Rol } from 'src/roles/entities/rol.entity';
import { NotificacionesService } from 'src/notificaciones/notificaciones.service';
import { TipoEventoNotificacion } from 'src/notificaciones/entities/notificacion.entity';
import {
  EstadoSolicitud,
  SolicitudReserva,
} from './entities/solicitud-reserva.entity';
import { Firma, ResultadoFirma, RolFirmante } from './entities/firma.entity';
import {
  SolicitudEvento,
  TipoEventoSolicitud,
} from './entities/solicitud-evento.entity';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { CreateSolicitudDirectaDto } from './dto/create-solicitud-directa.dto';
import { RechazarSolicitudDto } from './dto/rechazar-solicitud.dto';
import { FirmarSolicitudDto } from './dto/firmar-solicitud.dto';
import { CancelarSolicitudDto } from './dto/cancelar-solicitud.dto';

const DIAS_SEMANA_POR_INDICE: DiaSemana[] = [
  DiaSemana.DOMINGO,
  DiaSemana.LUNES,
  DiaSemana.MARTES,
  DiaSemana.MIERCOLES,
  DiaSemana.JUEVES,
  DiaSemana.VIERNES,
  DiaSemana.SABADO,
];

export interface FiltrosSolicitudes {
  estado?: EstadoSolicitud;
  idLaboratorio?: number;
  idPeriodo?: number;
  nombreLaboratorio?: string;
  nombreSolicitante?: string;
  fechaDesde?: string;
  fechaHasta?: string;
}

export interface BloqueDisponibilidad {
  origen: 'horario_academico' | 'solicitud';
  horaInicio: string;
  horaFin: string;
  esExclusiva: boolean;
  tipoReserva?: string;
  nombrePractica?: string;
  cuposOcupados?: number;
  capacidad?: number;
  /** Solo origen 'horario_academico': materia + grupo/código de esa clase. */
  nombreEspacio?: string;
}

@Injectable()
export class SolicitudesService {
  private readonly solicitudRepository: Repository<SolicitudReserva>;
  private readonly firmaRepository: Repository<Firma>;
  private readonly laboratorioRepository: Repository<Laboratorio>;
  private readonly espacioAcademicoRepository: Repository<EspacioAcademico>;
  private readonly espacioLaboratorioRepository: Repository<EspacioLaboratorio>;
  private readonly docenteLaboratorioRepository: Repository<DocenteLaboratorio>;
  private readonly tipoReservaRepository: Repository<TipoReserva>;
  private readonly periodoAcademicoRepository: Repository<PeriodoAcademico>;
  private readonly facultadRepository: Repository<Facultad>;
  private readonly usuarioRepository: Repository<Usuario>;
  private readonly horarioAcademicoRepository: Repository<HorarioAcademico>;
  private readonly rolRepository: Repository<Rol>;
  private readonly eventoRepository: Repository<SolicitudEvento>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly notificacionesService: NotificacionesService,
  ) {
    this.solicitudRepository = this.dataSource.getRepository(SolicitudReserva);
    this.firmaRepository = this.dataSource.getRepository(Firma);
    this.laboratorioRepository = this.dataSource.getRepository(Laboratorio);
    this.espacioAcademicoRepository =
      this.dataSource.getRepository(EspacioAcademico);
    this.espacioLaboratorioRepository =
      this.dataSource.getRepository(EspacioLaboratorio);
    this.docenteLaboratorioRepository =
      this.dataSource.getRepository(DocenteLaboratorio);
    this.tipoReservaRepository = this.dataSource.getRepository(TipoReserva);
    this.periodoAcademicoRepository =
      this.dataSource.getRepository(PeriodoAcademico);
    this.facultadRepository = this.dataSource.getRepository(Facultad);
    this.usuarioRepository = this.dataSource.getRepository(Usuario);
    this.horarioAcademicoRepository =
      this.dataSource.getRepository(HorarioAcademico);
    this.rolRepository = this.dataSource.getRepository(Rol);
    this.eventoRepository = this.dataSource.getRepository(SolicitudEvento);
  }

  /**
   * Único punto que escribe en solicitud_evento — append-only, se llama
   * desde cada lugar donde SolicitudesService ya cambiaba el estado (crear,
   * firmar, rechazar, cancelar). No lanza si falla: un evento de trazabilidad
   * que no se pudo guardar no debe tumbar la operación real que sí cambió el
   * estado de la solicitud.
   */
  private async registrarEvento(
    idSolicitud: number,
    tipo: TipoEventoSolicitud,
    idActor: string | null,
    detalle?: string | null,
  ): Promise<void> {
    try {
      const evento = this.eventoRepository.create({
        idSolicitud,
        tipo,
        idActor,
        detalle: detalle ?? null,
      });
      await this.eventoRepository.save(evento);
    } catch (error) {
      console.error('No se pudo registrar el evento de trazabilidad', error);
    }
  }

  // ───────────────────────── helpers de negocio ─────────────────────────

  private diaSemanaDeFecha(fechaISO: string): DiaSemana {
    const indice = new Date(`${fechaISO}T00:00:00Z`).getUTCDay();
    return DIAS_SEMANA_POR_INDICE[indice];
  }

  /**
   * Las horas del DTO llegan como "HH:mm" pero las que vuelven de la BD
   * (columnas TIME) llegan como "HH:mm:ss" — comparar strings de distinta
   * longitud produce falsos cruces (ej. "09:00" < "09:00:00" es true por
   * ser prefijo). Se normalizan ambas a "HH:mm:ss" antes de comparar.
   */
  private normalizarHora(hora: string): string {
    return hora.length === 5 ? `${hora}:00` : hora;
  }

  private horasCruzan(
    inicioA: string,
    finA: string,
    inicioB: string,
    finB: string,
  ): boolean {
    const iA = this.normalizarHora(inicioA);
    const fA = this.normalizarHora(finA);
    const iB = this.normalizarHora(inicioB);
    const fB = this.normalizarHora(finB);
    return iA < fB && fA > iB;
  }

  private consumoCupos(numPersonas: number): number {
    return process.env.AFORO_MODO === 'por_reserva' ? 1 : numPersonas;
  }

  private async horarioAcademicoCruza(
    idLaboratorio: number,
    fechaPractica: string,
    horaInicio: string,
    horaFin: string,
  ): Promise<boolean> {
    const diaSemana = this.diaSemanaDeFecha(fechaPractica);

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
      .andWhere('periodo.fecha_inicio <= :fecha', { fecha: fechaPractica })
      .andWhere('periodo.fecha_fin >= :fecha', { fecha: fechaPractica })
      .getMany();

    return horarios.some((h) =>
      this.horasCruzan(horaInicio, horaFin, h.horaInicio, h.horaFin),
    );
  }

  private async solicitudesAprobadasQueCruzan(
    idLaboratorio: number,
    fechaPractica: string,
    horaInicio: string,
    horaFin: string,
    idSolicitudExcluir?: number,
  ): Promise<SolicitudReserva[]> {
    const query = this.solicitudRepository
      .createQueryBuilder('solicitud')
      .leftJoinAndSelect('solicitud.tipoReserva', 'tipoReserva')
      .where('solicitud.id_laboratorio = :idLaboratorio', { idLaboratorio })
      .andWhere('solicitud.fecha_practica = :fecha', { fecha: fechaPractica })
      // REALIZADA cuenta igual que APROBADA acá: la franja ya se usó, así
      // que sigue ocupada para efectos de cruce — solo cambió porque el
      // laboratorista ya registró bitácora, no porque el horario se liberó.
      .andWhere('solicitud.estado IN (:...estados)', {
        estados: [EstadoSolicitud.APROBADA, EstadoSolicitud.REALIZADA],
      });

    if (idSolicitudExcluir) {
      query.andWhere('solicitud.id_solicitud != :idExcluir', {
        idExcluir: idSolicitudExcluir,
      });
    }

    const candidatas = await query.getMany();
    return candidatas.filter((s) =>
      this.horasCruzan(horaInicio, horaFin, s.horaInicio, s.horaFin),
    );
  }

  private async verificarDisponibilidad(params: {
    idLaboratorio: number;
    capacidadLaboratorio: number;
    fechaPractica: string;
    horaInicio: string;
    horaFin: string;
    esExclusiva: boolean;
    numPersonas: number;
    idSolicitudExcluir?: number;
  }): Promise<{ disponible: boolean; motivo?: string }> {
    const cruzaHorario = await this.horarioAcademicoCruza(
      params.idLaboratorio,
      params.fechaPractica,
      params.horaInicio,
      params.horaFin,
    );
    if (cruzaHorario) {
      return {
        disponible: false,
        motivo: 'Cruza con un horario académico programado',
      };
    }

    const aprobadasQueCruzan = await this.solicitudesAprobadasQueCruzan(
      params.idLaboratorio,
      params.fechaPractica,
      params.horaInicio,
      params.horaFin,
      params.idSolicitudExcluir,
    );

    if (aprobadasQueCruzan.length > 0) {
      if (params.esExclusiva) {
        return {
          disponible: false,
          motivo:
            'Este tipo de reserva es exclusivo (como Docencia) y exige el laboratorio ' +
            'completamente libre en ese horario, sin compartir aforo con otras reservas. ' +
            'Ya existe una reserva aprobada que cruza este horario — elige otro horario ' +
            'o laboratorio',
        };
      }

      const hayExclusivaQueCruza = aprobadasQueCruzan.some(
        (s) => s.tipoReserva.esExclusiva,
      );
      if (hayExclusivaQueCruza) {
        return {
          disponible: false,
          motivo:
            'Ya existe una reserva exclusiva aprobada (como Docencia) que cruza este ' +
            'horario — ese tipo bloquea el laboratorio completo, sin dejar aforo ' +
            'compartido disponible',
        };
      }
    }

    // Antes esto solo corría si ya había otra solicitud aprobada cruzando el
    // horario (aprobadasQueCruzan.length > 0) — si esta era la PRIMERA
    // reserva de la franja, el chequeo de aforo se saltaba entero y
    // numPersonas pasaba sin tope real contra la capacidad del laboratorio.
    const cuposOcupados = aprobadasQueCruzan.reduce(
      (total, s) => total + this.consumoCupos(s.numPersonas),
      0,
    );
    const cabeLaNueva =
      cuposOcupados + this.consumoCupos(params.numPersonas) <=
      params.capacidadLaboratorio;

    return cabeLaNueva
      ? { disponible: true }
      : {
          disponible: false,
          motivo: `Sin cupo disponible (${cuposOcupados}/${params.capacidadLaboratorio} ocupados)`,
        };
  }

  private async esUsuarioConRol(
    idUsuario: string,
    nombreRol: string,
  ): Promise<boolean> {
    const usuario = await this.usuarioRepository.findOne({
      where: { idUsuario },
      relations: { rol: true },
    });
    return !!usuario && usuario.rol.nombre === nombreRol;
  }

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

  // ───────────────────────── creación ─────────────────────────

  async create(
    dto: CreateSolicitudDto,
    solicitante: AuthenticatedUser,
  ): Promise<SolicitudReserva> {
    const tipoReserva = await this.tipoReservaRepository.findOne({
      where: { idTipo: dto.idTipo },
    });
    if (!tipoReserva) {
      throw new HttpException(
        'Tipo de reserva no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    if (tipoReserva.esExclusiva && solicitante.rol !== 'docente') {
      throw new HttpException(
        'Solo un docente puede crear una reserva de tipo exclusivo',
        HttpStatus.FORBIDDEN,
      );
    }

    // Solo los tipos con requiereEspacio = true (hoy, únicamente "Docencia")
    // necesitan un espacio académico asociado al laboratorio — exigirlo para
    // TODOS los tipos bloqueaba cualquier reserva (incluso "Práctica libre",
    // "CAU", etc.) en un laboratorio que no tuviera ningún espacio académico
    // asociado, sin que eso tuviera nada que ver con el tipo de reserva pedido.
    if (tipoReserva.requiereEspacio) {
      if (!dto.idEspacio) {
        throw new HttpException(
          'Este tipo de reserva requiere indicar un espacio académico',
          HttpStatus.BAD_REQUEST,
        );
      }
      const espacio = await this.espacioAcademicoRepository.findOne({
        where: { idEspacio: dto.idEspacio },
      });
      if (!espacio) {
        throw new HttpException(
          'Espacio académico no encontrado',
          HttpStatus.NOT_FOUND,
        );
      }

      const espacioAsociado = await this.espacioLaboratorioRepository.exists({
        where: { idEspacio: dto.idEspacio, idLaboratorio: dto.idLaboratorio },
      });
      if (!espacioAsociado) {
        throw new HttpException(
          'El laboratorio elegido no está asociado a ese espacio académico',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const docenteAsociado = await this.docenteLaboratorioRepository.exists({
      where: {
        idUsuario: dto.idDocenteEncargado,
        idLaboratorio: dto.idLaboratorio,
      },
    });
    if (!docenteAsociado) {
      throw new HttpException(
        'El docente encargado no está asociado a este laboratorio',
        HttpStatus.BAD_REQUEST,
      );
    }

    const laboratorio = await this.laboratorioRepository.findOne({
      where: { idLaboratorio: dto.idLaboratorio },
    });
    if (!laboratorio) {
      throw new HttpException(
        'Laboratorio no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    if (laboratorio.estado === EstadoLaboratorio.INACTIVO) {
      throw new HttpException(
        'El laboratorio está inactivo',
        HttpStatus.CONFLICT,
      );
    }
    if (laboratorio.modoReserva !== ModoReservaLaboratorio.ESTANDAR) {
      throw new HttpException(
        'Este laboratorio no admite solicitudes de reserva (no está en modo estándar)',
        HttpStatus.BAD_REQUEST,
      );
    }

    const esDocenteExclusivo =
      solicitante.rol === 'docente' && tipoReserva.esExclusiva;
    if ((dto.grupoAsignatura || dto.numGruposTrabajo) && !esDocenteExclusivo) {
      throw new HttpException(
        'grupoAsignatura/numGruposTrabajo solo aplican para un docente creando un tipo exclusivo',
        HttpStatus.BAD_REQUEST,
      );
    }

    const periodo = await this.periodoAcademicoRepository.findOne({
      where: { idPeriodo: dto.idPeriodo },
    });
    if (!periodo) {
      throw new HttpException(
        'Periodo académico no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    if (
      dto.fechaPractica < periodo.fechaInicio ||
      dto.fechaPractica > periodo.fechaFin
    ) {
      throw new HttpException(
        'La fecha de práctica está fuera del periodo académico',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.semana && (dto.semana < 1 || dto.semana > periodo.numSemanas)) {
      throw new HttpException(
        `semana debe estar entre 1 y ${periodo.numSemanas}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.horaFin <= dto.horaInicio) {
      throw new HttpException(
        'La hora de fin debe ser posterior a la hora de inicio',
        HttpStatus.BAD_REQUEST,
      );
    }

    const antelacionDias = Number(process.env.RESERVA_ANTELACION_DIAS ?? 3);
    const hoy = hoyBogota();
    const minimaFecha = new Date(hoy);
    minimaFecha.setUTCDate(minimaFecha.getUTCDate() + antelacionDias);
    if (new Date(`${dto.fechaPractica}T00:00:00Z`) < minimaFecha) {
      throw new HttpException(
        `La fecha de práctica debe tener al menos ${antelacionDias} días de antelación`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const facultad = await this.facultadRepository.findOne({
      where: { idFacultad: dto.idFacultad },
    });
    if (!facultad) {
      throw new HttpException('Facultad no encontrada', HttpStatus.NOT_FOUND);
    }

    const disponibilidad = await this.verificarDisponibilidad({
      idLaboratorio: dto.idLaboratorio,
      // No-null: garantizado por el guard de modoReserva === ESTANDAR en create/crearDirecta,
      // y una solicitud solo puede referenciar un laboratorio que ya era estándar al crearse.
      capacidadLaboratorio: laboratorio.capacidad ?? 0,
      fechaPractica: dto.fechaPractica,
      horaInicio: dto.horaInicio,
      horaFin: dto.horaFin,
      esExclusiva: tipoReserva.esExclusiva,
      numPersonas: dto.numPersonas,
    });
    if (!disponibilidad.disponible) {
      throw new HttpException(
        `Sin disponibilidad: ${disponibilidad.motivo}`,
        HttpStatus.CONFLICT,
      );
    }

    const estadoInicial =
      solicitante.rol === 'docente'
        ? EstadoSolicitud.PENDIENTE_LABORATORISTA
        : EstadoSolicitud.PENDIENTE_DOCENTE;

    const solicitudCreada = await this.dataSource.transaction(
      async (manager) => {
        const solicitudRepo = manager.getRepository(SolicitudReserva);
        const firmaRepo = manager.getRepository(Firma);

        const solicitud = solicitudRepo.create({
          idSolicitante: solicitante.id,
          idDocenteEncargado: dto.idDocenteEncargado,
          idLaboratorio: dto.idLaboratorio,
          idTipo: dto.idTipo,
          idEspacio: dto.idEspacio ?? null,
          idFacultad: dto.idFacultad,
          idPeriodo: dto.idPeriodo,
          grupoAsignatura: dto.grupoAsignatura ?? null,
          numGruposTrabajo: dto.numGruposTrabajo ?? null,
          fechaPractica: dto.fechaPractica,
          horaInicio: dto.horaInicio,
          horaFin: dto.horaFin,
          nombrePractica: dto.nombrePractica,
          numPersonas: dto.numPersonas,
          semana: dto.semana ?? null,
          reactivosSustancias: dto.reactivosSustancias ?? null,
          equiposInsumos: dto.equiposInsumos ?? null,
          materialesEstudiante: dto.materialesEstudiante ?? null,
          estado: estadoInicial,
        });
        const guardada = await solicitudRepo.save(solicitud);

        if (solicitante.rol === 'docente') {
          await firmaRepo.save(
            firmaRepo.create({
              idSolicitud: guardada.idSolicitud,
              orden: 1,
              rolFirmante: RolFirmante.LABORATORISTA,
              resultado: ResultadoFirma.PENDIENTE,
            }),
          );
        } else {
          await firmaRepo.save(
            firmaRepo.create({
              idSolicitud: guardada.idSolicitud,
              orden: 1,
              rolFirmante: RolFirmante.DOCENTE,
              idFirmante: dto.idDocenteEncargado,
              resultado: ResultadoFirma.PENDIENTE,
            }),
          );
          await firmaRepo.save(
            firmaRepo.create({
              idSolicitud: guardada.idSolicitud,
              orden: 2,
              rolFirmante: RolFirmante.LABORATORISTA,
              resultado: ResultadoFirma.PENDIENTE,
            }),
          );
        }

        return guardada;
      },
    );

    // Confirmación al propio solicitante — sin importar quién crea la
    // reserva (estudiante o docente) ni a quién le toca firmar después. Va
    // primero y separado del resto: antes solo se avisaba a quien tenía que
    // firmar/gestionar, y quien creó la reserva no tenía forma de saber por
    // correo que sí se había enviado.
    await this.notificacionesService.notificar(
      TipoEventoNotificacion.SOLICITUD_ENVIADA,
      solicitudCreada,
      [{ idUsuario: solicitante.id, correo: solicitante.correo }],
    );

    if (estadoInicial === EstadoSolicitud.PENDIENTE_DOCENTE) {
      const docente = await this.usuarioRepository.findOne({
        where: { idUsuario: dto.idDocenteEncargado },
      });
      if (docente) {
        await this.notificacionesService.notificar(
          TipoEventoNotificacion.SOLICITUD_CREADA,
          solicitudCreada,
          [{ idUsuario: docente.idUsuario, correo: docente.correo }],
        );
      }
    } else {
      await this.notificacionesService.notificar(
        TipoEventoNotificacion.PENDIENTE_FIRMA,
        solicitudCreada,
        await this.todosLosLaboratoristas(),
      );
    }

    await this.registrarEvento(
      solicitudCreada.idSolicitud,
      TipoEventoSolicitud.CREADA,
      solicitante.id,
    );

    return this.findOne(solicitudCreada.idSolicitud, solicitante);
  }

  /**
   * Creación directa reservada a admin y laboratorista (ver @Roles en el
   * controller): se salta el flujo de firmas y la antelación mínima, pero
   * NO se salta ninguna validación de disponibilidad
   * (verificarDisponibilidad/horasCruzan corren igual que en create()) ni la
   * de fecha pasada. Queda aprobada de inmediato, con firmas ya resueltas
   * (idFirmante = quien la creó) para dejar trazabilidad de quién la generó.
   */
  async crearDirecta(
    dto: CreateSolicitudDirectaDto,
    creador: AuthenticatedUser,
  ): Promise<SolicitudReserva> {
    const tipoReserva = await this.tipoReservaRepository.findOne({
      where: { idTipo: dto.idTipo },
    });
    if (!tipoReserva) {
      throw new HttpException(
        'Tipo de reserva no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    // Ver comentario equivalente en create(): solo los tipos con
    // requiereEspacio = true necesitan un espacio académico asociado.
    if (tipoReserva.requiereEspacio) {
      if (!dto.idEspacio) {
        throw new HttpException(
          'Este tipo de reserva requiere indicar un espacio académico',
          HttpStatus.BAD_REQUEST,
        );
      }
      const espacio = await this.espacioAcademicoRepository.findOne({
        where: { idEspacio: dto.idEspacio },
      });
      if (!espacio) {
        throw new HttpException(
          'Espacio académico no encontrado',
          HttpStatus.NOT_FOUND,
        );
      }

      const espacioAsociado = await this.espacioLaboratorioRepository.exists({
        where: { idEspacio: dto.idEspacio, idLaboratorio: dto.idLaboratorio },
      });
      if (!espacioAsociado) {
        throw new HttpException(
          'El laboratorio elegido no está asociado a ese espacio académico',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const docenteAsociado = await this.docenteLaboratorioRepository.exists({
      where: {
        idUsuario: dto.idDocenteEncargado,
        idLaboratorio: dto.idLaboratorio,
      },
    });
    if (!docenteAsociado) {
      throw new HttpException(
        'El docente encargado no está asociado a este laboratorio',
        HttpStatus.BAD_REQUEST,
      );
    }

    const laboratorio = await this.laboratorioRepository.findOne({
      where: { idLaboratorio: dto.idLaboratorio },
    });
    if (!laboratorio) {
      throw new HttpException(
        'Laboratorio no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    if (laboratorio.estado === EstadoLaboratorio.INACTIVO) {
      throw new HttpException(
        'El laboratorio está inactivo',
        HttpStatus.CONFLICT,
      );
    }
    if (laboratorio.modoReserva !== ModoReservaLaboratorio.ESTANDAR) {
      throw new HttpException(
        'Este laboratorio no admite solicitudes de reserva (no está en modo estándar)',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      (dto.grupoAsignatura || dto.numGruposTrabajo) &&
      !tipoReserva.esExclusiva
    ) {
      throw new HttpException(
        'grupoAsignatura/numGruposTrabajo solo aplican para un tipo exclusivo',
        HttpStatus.BAD_REQUEST,
      );
    }

    const periodo = await this.periodoAcademicoRepository.findOne({
      where: { idPeriodo: dto.idPeriodo },
    });
    if (!periodo) {
      throw new HttpException(
        'Periodo académico no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    if (
      dto.fechaPractica < periodo.fechaInicio ||
      dto.fechaPractica > periodo.fechaFin
    ) {
      throw new HttpException(
        'La fecha de práctica está fuera del periodo académico',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.semana && (dto.semana < 1 || dto.semana > periodo.numSemanas)) {
      throw new HttpException(
        `semana debe estar entre 1 y ${periodo.numSemanas}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.horaFin <= dto.horaInicio) {
      throw new HttpException(
        'La hora de fin debe ser posterior a la hora de inicio',
        HttpStatus.BAD_REQUEST,
      );
    }

    const hoy = hoyBogota();
    if (new Date(`${dto.fechaPractica}T00:00:00Z`) < hoy) {
      throw new HttpException(
        'La fecha de práctica no puede ser en el pasado',
        HttpStatus.BAD_REQUEST,
      );
    }

    const facultad = await this.facultadRepository.findOne({
      where: { idFacultad: dto.idFacultad },
    });
    if (!facultad) {
      throw new HttpException('Facultad no encontrada', HttpStatus.NOT_FOUND);
    }

    const disponibilidad = await this.verificarDisponibilidad({
      idLaboratorio: dto.idLaboratorio,
      // No-null: garantizado por el guard de modoReserva === ESTANDAR en create/crearDirecta,
      // y una solicitud solo puede referenciar un laboratorio que ya era estándar al crearse.
      capacidadLaboratorio: laboratorio.capacidad ?? 0,
      fechaPractica: dto.fechaPractica,
      horaInicio: dto.horaInicio,
      horaFin: dto.horaFin,
      esExclusiva: tipoReserva.esExclusiva,
      numPersonas: dto.numPersonas,
    });
    if (!disponibilidad.disponible) {
      throw new HttpException(
        `Sin disponibilidad: ${disponibilidad.motivo}`,
        HttpStatus.CONFLICT,
      );
    }

    const ahora = new Date();
    const solicitudCreada = await this.dataSource.transaction(
      async (manager) => {
        const solicitudRepo = manager.getRepository(SolicitudReserva);
        const firmaRepo = manager.getRepository(Firma);

        const solicitud = solicitudRepo.create({
          idSolicitante: creador.id,
          idDocenteEncargado: dto.idDocenteEncargado,
          idLaboratorio: dto.idLaboratorio,
          idTipo: dto.idTipo,
          idEspacio: dto.idEspacio ?? null,
          idFacultad: dto.idFacultad,
          idPeriodo: dto.idPeriodo,
          grupoAsignatura: dto.grupoAsignatura ?? null,
          numGruposTrabajo: dto.numGruposTrabajo ?? null,
          fechaPractica: dto.fechaPractica,
          horaInicio: dto.horaInicio,
          horaFin: dto.horaFin,
          nombrePractica: dto.nombrePractica,
          numPersonas: dto.numPersonas,
          semana: dto.semana ?? null,
          reactivosSustancias: dto.reactivosSustancias ?? null,
          equiposInsumos: dto.equiposInsumos ?? null,
          materialesEstudiante: dto.materialesEstudiante ?? null,
          estado: EstadoSolicitud.APROBADA,
        });
        const guardada = await solicitudRepo.save(solicitud);

        await firmaRepo.save(
          firmaRepo.create({
            idSolicitud: guardada.idSolicitud,
            orden: 1,
            rolFirmante: RolFirmante.DOCENTE,
            idFirmante: creador.id,
            resultado: ResultadoFirma.APROBADA,
            fechaHora: ahora,
          }),
        );
        await firmaRepo.save(
          firmaRepo.create({
            idSolicitud: guardada.idSolicitud,
            orden: 2,
            rolFirmante: RolFirmante.LABORATORISTA,
            idFirmante: creador.id,
            resultado: ResultadoFirma.APROBADA,
            fechaHora: ahora,
          }),
        );

        return guardada;
      },
    );

    const docente = await this.usuarioRepository.findOne({
      where: { idUsuario: dto.idDocenteEncargado },
    });
    const destinatarios = [
      ...(docente
        ? [{ idUsuario: docente.idUsuario, correo: docente.correo }]
        : []),
      ...(await this.todosLosLaboratoristas()),
    ];
    if (destinatarios.length > 0) {
      await this.notificacionesService.notificar(
        TipoEventoNotificacion.SOLICITUD_APROBADA,
        solicitudCreada,
        destinatarios,
      );
    }

    const detalleDirecta = `Reserva directa creada por ${creador.rol === 'admin' ? 'un administrador' : 'un laboratorista'} (sin firmas ni antelación mínima)`;
    await this.registrarEvento(
      solicitudCreada.idSolicitud,
      TipoEventoSolicitud.CREADA,
      creador.id,
      detalleDirecta,
    );
    await this.registrarEvento(
      solicitudCreada.idSolicitud,
      TipoEventoSolicitud.FIRMA_DOCENTE_APROBADA,
      creador.id,
      detalleDirecta,
    );
    await this.registrarEvento(
      solicitudCreada.idSolicitud,
      TipoEventoSolicitud.FIRMA_LABORATORISTA_APROBADA,
      creador.id,
      detalleDirecta,
    );

    return this.findOne(solicitudCreada.idSolicitud, creador);
  }

  // ───────────────────────── verbos de negocio ─────────────────────────

  private async cargarConFirmas(
    idSolicitud: number,
  ): Promise<SolicitudReserva> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { idSolicitud },
      relations: { firmas: true, eventos: true },
      order: { eventos: { fecha: 'ASC' } },
    });
    if (!solicitud) {
      throw new HttpException('Solicitud no encontrada', HttpStatus.NOT_FOUND);
    }
    return solicitud;
  }

  async firmar(
    idSolicitud: number,
    usuario: AuthenticatedUser,
    dto?: FirmarSolicitudDto,
  ): Promise<SolicitudReserva> {
    const solicitud = await this.cargarConFirmas(idSolicitud);

    if (solicitud.estado === EstadoSolicitud.PENDIENTE_DOCENTE) {
      if (usuario.id !== solicitud.idDocenteEncargado) {
        throw new HttpException(
          'Solo el docente encargado puede firmar en este punto',
          HttpStatus.FORBIDDEN,
        );
      }

      const resultado = await this.firmaRepository.update(
        {
          idSolicitud,
          orden: 1,
          resultado: ResultadoFirma.PENDIENTE,
        },
        {
          resultado: ResultadoFirma.APROBADA,
          idFirmante: usuario.id,
          fechaHora: new Date(),
          observacion: dto?.observacion ?? null,
        },
      );
      if (resultado.affected === 0) {
        throw new HttpException(
          'Esta firma ya fue resuelta',
          HttpStatus.CONFLICT,
        );
      }

      await this.solicitudRepository.update(
        { idSolicitud },
        { estado: EstadoSolicitud.PENDIENTE_LABORATORISTA },
      );

      const actualizada = await this.cargarConFirmas(idSolicitud);
      await this.notificacionesService.notificar(
        TipoEventoNotificacion.FIRMA_APROBADA,
        actualizada,
        [
          {
            idUsuario: solicitud.idSolicitante,
            correo: (
              await this.usuarioRepository.findOneByOrFail({
                idUsuario: solicitud.idSolicitante,
              })
            ).correo,
          },
        ],
      );
      await this.notificacionesService.notificar(
        TipoEventoNotificacion.PENDIENTE_FIRMA,
        actualizada,
        await this.todosLosLaboratoristas(),
      );
      await this.registrarEvento(
        idSolicitud,
        TipoEventoSolicitud.FIRMA_DOCENTE_APROBADA,
        usuario.id,
        dto?.observacion,
      );
      return actualizada;
    }

    if (solicitud.estado === EstadoSolicitud.PENDIENTE_LABORATORISTA) {
      if (usuario.rol !== 'laboratorista') {
        throw new HttpException(
          'Solo un laboratorista puede resolver esta firma',
          HttpStatus.FORBIDDEN,
        );
      }

      const firmaLaboratorista = solicitud.firmas.find(
        (f) => f.rolFirmante === RolFirmante.LABORATORISTA,
      )!;

      const laboratorio = await this.laboratorioRepository.findOneByOrFail({
        idLaboratorio: solicitud.idLaboratorio,
      });
      const tipoReserva = await this.tipoReservaRepository.findOneByOrFail({
        idTipo: solicitud.idTipo,
      });

      const disponibilidad = await this.verificarDisponibilidad({
        idLaboratorio: solicitud.idLaboratorio,
        // No-null: garantizado por el guard de modoReserva === ESTANDAR en create/crearDirecta,
        // y una solicitud solo puede referenciar un laboratorio que ya era estándar al crearse.
        capacidadLaboratorio: laboratorio.capacidad ?? 0,
        fechaPractica: solicitud.fechaPractica,
        horaInicio: solicitud.horaInicio,
        horaFin: solicitud.horaFin,
        esExclusiva: tipoReserva.esExclusiva,
        numPersonas: solicitud.numPersonas,
        idSolicitudExcluir: solicitud.idSolicitud,
      });

      if (!disponibilidad.disponible) {
        const resultado = await this.firmaRepository.update(
          {
            idSolicitud,
            orden: firmaLaboratorista.orden,
            resultado: ResultadoFirma.PENDIENTE,
          },
          {
            resultado: ResultadoFirma.RECHAZADA,
            observacion: `Rechazo automático del sistema: ${disponibilidad.motivo}`,
            idFirmante: usuario.id,
            fechaHora: new Date(),
          },
        );
        if (resultado.affected === 0) {
          throw new HttpException(
            'Otro laboratorista ya resolvió esta solicitud',
            HttpStatus.CONFLICT,
          );
        }

        await this.solicitudRepository.update(
          { idSolicitud },
          { estado: EstadoSolicitud.RECHAZADA },
        );

        const actualizada = await this.cargarConFirmas(idSolicitud);
        const solicitanteUsuario = await this.usuarioRepository.findOneByOrFail(
          {
            idUsuario: solicitud.idSolicitante,
          },
        );
        await this.notificacionesService.notificar(
          TipoEventoNotificacion.SOLICITUD_RECHAZADA,
          actualizada,
          [
            {
              idUsuario: solicitanteUsuario.idUsuario,
              correo: solicitanteUsuario.correo,
            },
          ],
          `Sin disponibilidad al momento de firmar: ${disponibilidad.motivo}`,
        );
        await this.registrarEvento(
          idSolicitud,
          TipoEventoSolicitud.FIRMA_LABORATORISTA_RECHAZADA,
          usuario.id,
          `Rechazo automático del sistema: ${disponibilidad.motivo}`,
        );

        throw new HttpException(
          `Sin disponibilidad: ${disponibilidad.motivo}. La solicitud quedó rechazada.`,
          HttpStatus.CONFLICT,
        );
      }

      const resultado = await this.firmaRepository.update(
        {
          idSolicitud,
          orden: firmaLaboratorista.orden,
          resultado: ResultadoFirma.PENDIENTE,
        },
        {
          resultado: ResultadoFirma.APROBADA,
          idFirmante: usuario.id,
          fechaHora: new Date(),
          observacion: dto?.observacion ?? null,
        },
      );
      if (resultado.affected === 0) {
        throw new HttpException(
          'Otro laboratorista ya resolvió esta solicitud',
          HttpStatus.CONFLICT,
        );
      }

      await this.solicitudRepository.update(
        { idSolicitud },
        { estado: EstadoSolicitud.APROBADA },
      );

      const actualizada = await this.cargarConFirmas(idSolicitud);
      const solicitanteUsuario = await this.usuarioRepository.findOneByOrFail({
        idUsuario: solicitud.idSolicitante,
      });
      await this.notificacionesService.notificar(
        TipoEventoNotificacion.SOLICITUD_APROBADA,
        actualizada,
        [
          {
            idUsuario: solicitanteUsuario.idUsuario,
            correo: solicitanteUsuario.correo,
          },
        ],
      );
      await this.registrarEvento(
        idSolicitud,
        TipoEventoSolicitud.FIRMA_LABORATORISTA_APROBADA,
        usuario.id,
        dto?.observacion,
      );
      return actualizada;
    }

    throw new HttpException(
      'La solicitud ya fue resuelta, no admite más firmas',
      HttpStatus.CONFLICT,
    );
  }

  async rechazar(
    idSolicitud: number,
    usuario: AuthenticatedUser,
    dto: RechazarSolicitudDto,
  ): Promise<SolicitudReserva> {
    const solicitud = await this.cargarConFirmas(idSolicitud);

    let ordenAResolver: number;
    const rolQueRechaza =
      solicitud.estado === EstadoSolicitud.PENDIENTE_DOCENTE
        ? TipoEventoSolicitud.FIRMA_DOCENTE_RECHAZADA
        : TipoEventoSolicitud.FIRMA_LABORATORISTA_RECHAZADA;
    if (solicitud.estado === EstadoSolicitud.PENDIENTE_DOCENTE) {
      if (usuario.id !== solicitud.idDocenteEncargado) {
        throw new HttpException(
          'Solo el docente encargado puede rechazar en este punto',
          HttpStatus.FORBIDDEN,
        );
      }
      ordenAResolver = 1;
    } else if (solicitud.estado === EstadoSolicitud.PENDIENTE_LABORATORISTA) {
      if (usuario.rol !== 'laboratorista') {
        throw new HttpException(
          'Solo un laboratorista puede rechazar en este punto',
          HttpStatus.FORBIDDEN,
        );
      }
      ordenAResolver = solicitud.firmas.find(
        (f) => f.rolFirmante === RolFirmante.LABORATORISTA,
      )!.orden;
    } else {
      throw new HttpException(
        'La solicitud ya fue resuelta',
        HttpStatus.CONFLICT,
      );
    }

    const resultado = await this.firmaRepository.update(
      {
        idSolicitud,
        orden: ordenAResolver,
        resultado: ResultadoFirma.PENDIENTE,
      },
      {
        resultado: ResultadoFirma.RECHAZADA,
        observacion: dto.motivo,
        idFirmante: usuario.id,
        fechaHora: new Date(),
      },
    );
    if (resultado.affected === 0) {
      throw new HttpException(
        'Esta firma ya fue resuelta por otra persona',
        HttpStatus.CONFLICT,
      );
    }

    await this.solicitudRepository.update(
      { idSolicitud },
      { estado: EstadoSolicitud.RECHAZADA },
    );

    const actualizada = await this.cargarConFirmas(idSolicitud);
    const solicitanteUsuario = await this.usuarioRepository.findOneByOrFail({
      idUsuario: solicitud.idSolicitante,
    });
    await this.notificacionesService.notificar(
      TipoEventoNotificacion.SOLICITUD_RECHAZADA,
      actualizada,
      [
        {
          idUsuario: solicitanteUsuario.idUsuario,
          correo: solicitanteUsuario.correo,
        },
      ],
      dto.motivo,
    );
    await this.registrarEvento(
      idSolicitud,
      rolQueRechaza,
      usuario.id,
      dto.motivo,
    );

    return actualizada;
  }

  async cancelar(
    idSolicitud: number,
    usuario: AuthenticatedUser,
    dto: CancelarSolicitudDto,
  ): Promise<SolicitudReserva> {
    const solicitud = await this.cargarConFirmas(idSolicitud);

    const esSolicitante = usuario.id === solicitud.idSolicitante;
    const esAdmin = usuario.rol === 'admin';
    if (!esSolicitante && !esAdmin) {
      throw new HttpException(
        'Solo el solicitante o un administrador pueden cancelar',
        HttpStatus.FORBIDDEN,
      );
    }

    const estadosPermitidos: EstadoSolicitud[] = [
      EstadoSolicitud.PENDIENTE_DOCENTE,
      EstadoSolicitud.PENDIENTE_LABORATORISTA,
      EstadoSolicitud.APROBADA,
    ];
    if (!estadosPermitidos.includes(solicitud.estado)) {
      throw new HttpException(
        'La solicitud no se puede cancelar en su estado actual',
        HttpStatus.CONFLICT,
      );
    }

    await this.solicitudRepository.update(
      { idSolicitud },
      {
        estado: EstadoSolicitud.CANCELADA,
        motivoCancelacion: dto.motivoCancelacion ?? null,
      },
    );

    const actualizada = await this.cargarConFirmas(idSolicitud);
    const solicitanteUsuario = await this.usuarioRepository.findOneByOrFail({
      idUsuario: solicitud.idSolicitante,
    });
    await this.notificacionesService.notificar(
      TipoEventoNotificacion.SOLICITUD_CANCELADA,
      actualizada,
      [
        {
          idUsuario: solicitanteUsuario.idUsuario,
          correo: solicitanteUsuario.correo,
        },
      ],
    );
    await this.registrarEvento(
      idSolicitud,
      TipoEventoSolicitud.CANCELADA,
      usuario.id,
      dto.motivoCancelacion,
    );

    return actualizada;
  }

  /**
   * Cierra el flujo: lo llama BitacoraService.create justo después de
   * registrar el uso real de una solicitud aprobada — sin esto, una
   * solicitud aprobada se quedaba en ese estado para siempre, sin ningún
   * indicio de que la práctica ya ocurrió. No valida el estado actual (ya
   * lo valida BitacoraService antes de dejar registrar bitácora) ni lanza
   * si algo falla en el camino — un problema acá no debe tumbar el registro
   * de bitácora que sí se guardó.
   */
  async marcarRealizada(idSolicitud: number, idActor: string): Promise<void> {
    try {
      await this.solicitudRepository.update(
        { idSolicitud },
        { estado: EstadoSolicitud.REALIZADA },
      );
      await this.registrarEvento(
        idSolicitud,
        TipoEventoSolicitud.REALIZADA,
        idActor,
      );
    } catch (error) {
      console.error('No se pudo marcar la solicitud como realizada', error);
    }
  }

  // ───────────────────────── lecturas ─────────────────────────

  /**
   * Modo dual: sin `pagination` devuelve el arreglo completo (lo usa Inicio
   * para calcular los contadores del dashboard, que necesitan el total real,
   * no una página); con `pagination` devuelve `PaginatedResult`, para "Mis
   * solicitudes". `skip`/`take` van por `find()` (no createQueryBuilder) a
   * propósito: con relaciones one-to-many (firmas/eventos) un JOIN manual
   * aplicaría el LIMIT/OFFSET sobre las filas ya combinadas, cortando a mitad
   * de una solicitud — el repositorio resuelve cada relación aparte.
   */
  findMias(
    usuario: AuthenticatedUser,
    archivadas?: boolean,
  ): Promise<SolicitudReserva[]>;
  findMias(
    usuario: AuthenticatedUser,
    archivadas: boolean,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<SolicitudReserva>>;
  async findMias(
    usuario: AuthenticatedUser,
    archivadas = false,
    pagination?: PaginationParams,
  ): Promise<SolicitudReserva[] | PaginatedResult<SolicitudReserva>> {
    const where = {
      idSolicitante: usuario.id,
      archivada: archivadas,
      eliminada: false,
    };
    const relations = { firmas: true, eventos: true };
    const order = {
      fechaCreacion: 'DESC' as const,
      eventos: { fecha: 'ASC' as const },
    };

    if (!pagination) {
      return this.solicitudRepository.find({ where, relations, order });
    }

    const [data, total] = await this.solicitudRepository.findAndCount({
      where,
      relations,
      order,
      skip: pagination.skip,
      take: pagination.take,
    });
    return buildPaginatedResult(data, total, pagination.page, pagination.limit);
  }

  /** Solo el solicitante, y solo si ya quedó resuelta (rechazada/cancelada)
   * — una vez archivada desaparece de findMias pero sigue existiendo para
   * Historial/Estadísticas/auditoría, que no filtran por esta bandera. */
  async archivar(
    id: number,
    usuario: AuthenticatedUser,
  ): Promise<SolicitudReserva> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { idSolicitud: id },
    });
    if (!solicitud) {
      throw new HttpException('Solicitud no encontrada', HttpStatus.NOT_FOUND);
    }
    if (solicitud.idSolicitante !== usuario.id) {
      throw new HttpException(
        'Solo el solicitante puede archivar su solicitud',
        HttpStatus.FORBIDDEN,
      );
    }
    const ESTADOS_ARCHIVABLES = [
      EstadoSolicitud.RECHAZADA,
      EstadoSolicitud.CANCELADA,
      EstadoSolicitud.REALIZADA,
    ];
    if (!ESTADOS_ARCHIVABLES.includes(solicitud.estado)) {
      throw new HttpException(
        `No se puede archivar una solicitud en estado "${solicitud.estado}"`,
        HttpStatus.CONFLICT,
      );
    }
    await this.solicitudRepository.update(
      { idSolicitud: id },
      { archivada: true },
    );
    return { ...solicitud, archivada: true };
  }

  /** Vuelve a mostrarla en Mis Solicitudes — sin restricción de estado, ya
   * que archivar tampoco cambia el estado, solo la visibilidad. */
  async desarchivar(
    id: number,
    usuario: AuthenticatedUser,
  ): Promise<SolicitudReserva> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { idSolicitud: id },
    });
    if (!solicitud) {
      throw new HttpException('Solicitud no encontrada', HttpStatus.NOT_FOUND);
    }
    if (solicitud.idSolicitante !== usuario.id) {
      throw new HttpException(
        'Solo el solicitante puede restaurar su solicitud',
        HttpStatus.FORBIDDEN,
      );
    }
    await this.solicitudRepository.update(
      { idSolicitud: id },
      { archivada: false },
    );
    return { ...solicitud, archivada: false };
  }

  /** Soft delete de TODAS las solicitudes archivadas del usuario — las saca
   * de Mis Solicitudes para siempre (ni activas ni archivadas). No toca
   * firma/solicitud_evento/notificacion ni las filas en sí: Historial y
   * Estadísticas no filtran por `eliminada`, así que el rastro de auditoría
   * para admin/laboratorista sigue intacto (ver comentario en la entidad). */
  async vaciarArchivadas(usuario: AuthenticatedUser): Promise<number> {
    const resultado = await this.solicitudRepository.update(
      { idSolicitante: usuario.id, archivada: true },
      { eliminada: true },
    );
    return resultado.affected ?? 0;
  }

  /**
   * Paginado en dos pasos por la misma razón que findAll (historial) y
   * BitacoraService.pendientesPorRegistrar: esta versión de TypeORM no
   * soporta un ORDER BY con subconsulta SQL cruda en una query que hidrata
   * entidades (getMany falla con "alias was not found"). Se resuelven
   * primero los ids ya ordenados con una query "raw" (getRawMany, sin
   * hidratar — ahí el orderBy crudo sí funciona) y luego se cargan esos ids
   * con sus relaciones, reordenando en JS.
   */
  async findPendientesDeMiFirma(
    usuario: AuthenticatedUser,
  ): Promise<SolicitudReserva[]> {
    if (usuario.rol !== 'docente' && usuario.rol !== 'laboratorista') {
      return [];
    }

    const idQuery = this.solicitudRepository
      .createQueryBuilder('solicitud')
      .select('solicitud.idSolicitud', 'idSolicitud')
      // Orden por el último evento real de cada solicitud (creada, firma
      // docente aprobada...), no por fecha_creacion: para el laboratorista,
      // lo que importa es desde cuándo le corresponde a ÉL resolverla — una
      // solicitud creada directo por un docente entra a su cola de inmediato
      // (evento "creada"), mientras que una de estudiante solo entra tras la
      // firma del docente (evento "firma_docente_aprobada"); ambas pueden
      // compartir fecha_creacion cercana pero llevar tiempos de espera muy
      // distintos en SU cola.
      .orderBy(
        '(SELECT MAX(ev.fecha) FROM solicitud_evento ev WHERE ev.id_solicitud = solicitud.id_solicitud)',
        'ASC',
      );

    if (usuario.rol === 'docente') {
      idQuery
        .andWhere('solicitud.estado = :estado', {
          estado: EstadoSolicitud.PENDIENTE_DOCENTE,
        })
        .andWhere('solicitud.id_docente_encargado = :idDocente', {
          idDocente: usuario.id,
        });
    } else {
      idQuery.andWhere('solicitud.estado = :estado', {
        estado: EstadoSolicitud.PENDIENTE_LABORATORISTA,
      });
    }

    const filas = await idQuery.getRawMany<{ idSolicitud: number }>();
    const ids = filas.map((fila) => fila.idSolicitud);
    if (ids.length === 0) {
      return [];
    }

    const data = await this.solicitudRepository
      .createQueryBuilder('solicitud')
      .leftJoinAndSelect('solicitud.firmas', 'firmas')
      .leftJoinAndSelect('solicitud.eventos', 'eventos')
      .leftJoinAndSelect('solicitud.espacioAcademico', 'espacioAcademico')
      .leftJoinAndSelect('solicitud.facultad', 'facultad')
      .leftJoinAndSelect('solicitud.periodoAcademico', 'periodoAcademico')
      .leftJoin('solicitud.solicitante', 'solicitante')
      .addSelect([
        'solicitante.idUsuario',
        'solicitante.nombre',
        'solicitante.correo',
      ])
      .leftJoin('solicitud.docenteEncargado', 'docenteEncargado')
      .addSelect([
        'docenteEncargado.idUsuario',
        'docenteEncargado.nombre',
        'docenteEncargado.correo',
      ])
      .where('solicitud.idSolicitud IN (:...ids)', { ids })
      .getMany();

    const posicion = new Map(ids.map((id, indice) => [id, indice]));
    return data.sort(
      (a, b) => posicion.get(a.idSolicitud)! - posicion.get(b.idSolicitud)!,
    );
  }

  async findOne(
    idSolicitud: number,
    usuario: AuthenticatedUser,
  ): Promise<SolicitudReserva> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { idSolicitud },
      relations: { firmas: true, eventos: true },
      order: { eventos: { fecha: 'ASC' } },
    });
    if (!solicitud) {
      throw new HttpException('Solicitud no encontrada', HttpStatus.NOT_FOUND);
    }

    const esSolicitante = usuario.id === solicitud.idSolicitante;
    const esFirmanteInvolucrado = solicitud.firmas.some(
      (f) => f.idFirmante === usuario.id,
    );
    const esLaboratorista = usuario.rol === 'laboratorista';
    const esAdmin = usuario.rol === 'admin';

    if (
      !esSolicitante &&
      !esFirmanteInvolucrado &&
      !esLaboratorista &&
      !esAdmin
    ) {
      throw new HttpException(
        'No tienes acceso a esta solicitud',
        HttpStatus.FORBIDDEN,
      );
    }

    return solicitud;
  }

  /**
   * Docente: solo las solicitudes donde es el encargado (cualquier estado) —
   * es su "historial" (a diferencia de /pendientes-de-mi-firma, que solo
   * muestra las que aún esperan su firma). Laboratorista/admin: todas, igual
   * que la bandeja compartida de firmas.
   */
  /**
   * Paginado en dos pasos a propósito: `firmas` es one-to-many, así que un
   * único query con leftJoinAndSelect(firmas) + skip/take paginaría sobre
   * filas ya multiplicadas por el join (el clásico bug de TypeORM con
   * paginación + relación 1-a-N — algunas solicitudes con varias firmas
   * quedarían repetidas o la página traería menos solicitudes reales de las
   * pedidas). Primero se resuelven los ids de la página (sin relaciones que
   * multipliquen filas) y luego se cargan esos ids con todas sus relaciones.
   */
  async findAll(
    usuario: AuthenticatedUser,
    filtros: FiltrosSolicitudes,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<SolicitudReserva>> {
    const idQuery = this.solicitudRepository
      .createQueryBuilder('solicitud')
      .leftJoin('solicitud.laboratorio', 'laboratorio')
      .leftJoin('solicitud.solicitante', 'solicitante')
      .select('solicitud.idSolicitud', 'idSolicitud')
      // Orden por el último evento real (creada, firmada, rechazada,
      // cancelada...), no por fecha_practica: el historial es una bitácora
      // de actividad — lo más recientemente modificado va primero, igual
      // que el orden natural de un feed. Mismo criterio de
      // "MAX(solicitud_evento.fecha)" que ya usan findPendientesDeMiFirma
      // (bandeja) y BitacoraService.pendientesPorRegistrar, solo que DESC
      // en vez de ASC — aquí interesa ver lo más reciente primero, no lo que
      // lleva más tiempo esperando.
      .orderBy(
        '(SELECT MAX(ev.fecha) FROM solicitud_evento ev WHERE ev.id_solicitud = solicitud.id_solicitud)',
        'DESC',
      )
      .addOrderBy('solicitud.idSolicitud', 'DESC');

    this.aplicarFiltrosHistorial(idQuery, usuario, filtros);

    const total = await idQuery.getCount();
    const filas = await idQuery
      .skip(pagination.skip)
      .take(pagination.take)
      .getRawMany<{ idSolicitud: number }>();
    const ids = filas.map((fila) => fila.idSolicitud);

    if (ids.length === 0) {
      return buildPaginatedResult([], total, pagination.page, pagination.limit);
    }

    const data = await this.solicitudRepository
      .createQueryBuilder('solicitud')
      .leftJoinAndSelect('solicitud.firmas', 'firmas')
      .leftJoinAndSelect('solicitud.eventos', 'eventos')
      .leftJoinAndSelect('solicitud.laboratorio', 'laboratorio')
      .leftJoinAndSelect('solicitud.tipoReserva', 'tipoReserva')
      .leftJoinAndSelect('solicitud.espacioAcademico', 'espacioAcademico')
      .leftJoin('solicitud.solicitante', 'solicitante')
      .addSelect([
        'solicitante.idUsuario',
        'solicitante.nombre',
        'solicitante.correo',
      ])
      .leftJoin('solicitud.docenteEncargado', 'docenteEncargado')
      .addSelect([
        'docenteEncargado.idUsuario',
        'docenteEncargado.nombre',
        'docenteEncargado.correo',
      ])
      .where('solicitud.idSolicitud IN (:...ids)', { ids })
      .getMany();

    // Sin orderBy aquí a propósito: esta versión de TypeORM no soporta un
    // ORDER BY con subconsulta SQL cruda en una query que hidrata entidades
    // con joins 1-a-N (falla con "alias was not found" — ver
    // createOrderByCombinedWithSelectExpression). El orden real ya lo dio
    // idQuery (arriba, con getRawMany — ahí sí funciona), así que aquí solo
    // se reordena en JS según la posición de cada id en `ids`.
    const posicion = new Map(ids.map((id, indice) => [id, indice]));
    data.sort(
      (a, b) => posicion.get(a.idSolicitud)! - posicion.get(b.idSolicitud)!,
    );

    return buildPaginatedResult(data, total, pagination.page, pagination.limit);
  }

  private aplicarFiltrosHistorial(
    query: SelectQueryBuilder<SolicitudReserva>,
    usuario: AuthenticatedUser,
    filtros: FiltrosSolicitudes,
  ): void {
    if (usuario.rol === 'docente') {
      query.andWhere('solicitud.id_docente_encargado = :idDocente', {
        idDocente: usuario.id,
      });
    }
    if (usuario.rol === 'laboratorista') {
      query.andWhere(
        'EXISTS (SELECT 1 FROM firma f WHERE f.id_solicitud = solicitud.id_solicitud AND f.id_firmante = :idLaboratorista)',
        { idLaboratorista: usuario.id },
      );
    }

    if (filtros.estado) {
      query.andWhere('solicitud.estado = :estado', {
        estado: filtros.estado,
      });
    }
    if (filtros.idLaboratorio) {
      query.andWhere('solicitud.id_laboratorio = :idLaboratorio', {
        idLaboratorio: filtros.idLaboratorio,
      });
    }
    if (filtros.idPeriodo) {
      query.andWhere('solicitud.id_periodo = :idPeriodo', {
        idPeriodo: filtros.idPeriodo,
      });
    }
    if (filtros.nombreLaboratorio) {
      query.andWhere('laboratorio.nombre LIKE :nombreLaboratorio', {
        nombreLaboratorio: `%${filtros.nombreLaboratorio}%`,
      });
    }
    if (filtros.nombreSolicitante) {
      query.andWhere('solicitante.nombre LIKE :nombreSolicitante', {
        nombreSolicitante: `%${filtros.nombreSolicitante}%`,
      });
    }
    if (filtros.fechaDesde) {
      query.andWhere('solicitud.fecha_practica >= :fechaDesde', {
        fechaDesde: filtros.fechaDesde,
      });
    }
    if (filtros.fechaHasta) {
      query.andWhere('solicitud.fecha_practica <= :fechaHasta', {
        fechaHasta: filtros.fechaHasta,
      });
    }
  }

  async disponibilidad(
    idLaboratorio: number,
    fecha: string,
  ): Promise<BloqueDisponibilidad[]> {
    const laboratorio = await this.laboratorioRepository.findOne({
      where: { idLaboratorio },
    });
    if (!laboratorio) {
      throw new HttpException(
        'Laboratorio no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    const diaSemana = this.diaSemanaDeFecha(fecha);
    const horarios = await this.horarioAcademicoRepository
      .createQueryBuilder('horario')
      .innerJoin(
        'periodo_academico',
        'periodo',
        'periodo.id_periodo = horario.id_periodo',
      )
      .leftJoinAndSelect('horario.espacioAcademico', 'espacioAcademico')
      .where('horario.id_laboratorio = :idLaboratorio', { idLaboratorio })
      .andWhere('horario.dia_semana = :diaSemana', { diaSemana })
      .andWhere('horario.estado = :estado', { estado: EstadoHorario.VIGENTE })
      .andWhere('periodo.fecha_inicio <= :fecha', { fecha })
      .andWhere('periodo.fecha_fin >= :fecha', { fecha })
      .getMany();

    const bloquesHorario: BloqueDisponibilidad[] = horarios.map((h) => ({
      origen: 'horario_academico',
      horaInicio: h.horaInicio,
      horaFin: h.horaFin,
      esExclusiva: true,
      nombreEspacio: [
        h.espacioAcademico?.nombre,
        h.grupoAsignatura && `- ${h.grupoAsignatura}`,
        h.codigo && `(${h.codigo})`,
      ]
        .filter(Boolean)
        .join(' ')
        .trim(),
    }));

    const solicitudes = await this.solicitudRepository.find({
      where: {
        idLaboratorio,
        fechaPractica: fecha,
        // Igual criterio que solicitudesAprobadasQueCruzan: una solicitud ya
        // REALIZADA sigue ocupando su franja en el calendario del día.
        estado: In([EstadoSolicitud.APROBADA, EstadoSolicitud.REALIZADA]),
      },
      relations: { tipoReserva: true },
    });

    const bloquesSolicitudes: BloqueDisponibilidad[] = solicitudes.map((s) => ({
      origen: 'solicitud',
      horaInicio: s.horaInicio,
      horaFin: s.horaFin,
      esExclusiva: s.tipoReserva.esExclusiva,
      tipoReserva: s.tipoReserva.nombre,
      nombrePractica: s.nombrePractica,
      ...(!s.tipoReserva.esExclusiva && {
        cuposOcupados: this.consumoCupos(s.numPersonas),
        capacidad: laboratorio.capacidad ?? undefined,
      }),
    }));

    return [...bloquesHorario, ...bloquesSolicitudes];
  }
}
