import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import type { AuthenticatedUser } from 'src/auth/decorators/current-user.decorator';
import {
  Laboratorio,
  EstadoLaboratorio,
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
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { CreateSolicitudDirectaDto } from './dto/create-solicitud-directa.dto';
import { RechazarSolicitudDto } from './dto/rechazar-solicitud.dto';
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
      .andWhere('solicitud.estado = :estado', {
        estado: EstadoSolicitud.APROBADA,
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

    if (aprobadasQueCruzan.length === 0) {
      return { disponible: true };
    }

    if (params.esExclusiva) {
      return {
        disponible: false,
        motivo: 'Ya existe una reserva aprobada que cruza en ese horario',
      };
    }

    const hayExclusivaQueCruza = aprobadasQueCruzan.some(
      (s) => s.tipoReserva.esExclusiva,
    );
    if (hayExclusivaQueCruza) {
      return {
        disponible: false,
        motivo:
          'Ya existe una reserva exclusiva aprobada que cruza en ese horario',
      };
    }

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

    if (tipoReserva.requiereEspacio && !dto.idEspacio) {
      throw new HttpException(
        'Este tipo de reserva exige elegir un espacio académico',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.idEspacio) {
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
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);
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
      capacidadLaboratorio: laboratorio.capacidad,
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

    return this.findOne(solicitudCreada.idSolicitud, solicitante);
  }

  /**
   * Creación directa reservada a admin: se salta el flujo de firmas y la
   * antelación mínima, pero NO se salta ninguna validación de disponibilidad
   * (verificarDisponibilidad/horasCruzan corren igual que en create()) ni la
   * de fecha pasada. Queda aprobada de inmediato, con firmas ya resueltas
   * (idFirmante = admin) para dejar trazabilidad de quién la generó.
   */
  async crearDirecta(
    dto: CreateSolicitudDirectaDto,
    admin: AuthenticatedUser,
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

    if (tipoReserva.requiereEspacio && !dto.idEspacio) {
      throw new HttpException(
        'Este tipo de reserva exige elegir un espacio académico',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.idEspacio) {
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

    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);
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
      capacidadLaboratorio: laboratorio.capacidad,
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
          idSolicitante: admin.id,
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
            idFirmante: admin.id,
            resultado: ResultadoFirma.APROBADA,
            fechaHora: ahora,
          }),
        );
        await firmaRepo.save(
          firmaRepo.create({
            idSolicitud: guardada.idSolicitud,
            orden: 2,
            rolFirmante: RolFirmante.LABORATORISTA,
            idFirmante: admin.id,
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
      ...(docente ? [{ idUsuario: docente.idUsuario, correo: docente.correo }] : []),
      ...(await this.todosLosLaboratoristas()),
    ];
    if (destinatarios.length > 0) {
      await this.notificacionesService.notificar(
        TipoEventoNotificacion.SOLICITUD_APROBADA,
        solicitudCreada,
        destinatarios,
      );
    }

    return this.findOne(solicitudCreada.idSolicitud, admin);
  }

  // ───────────────────────── verbos de negocio ─────────────────────────

  private async cargarConFirmas(
    idSolicitud: number,
  ): Promise<SolicitudReserva> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { idSolicitud },
      relations: { firmas: true },
    });
    if (!solicitud) {
      throw new HttpException('Solicitud no encontrada', HttpStatus.NOT_FOUND);
    }
    return solicitud;
  }

  async firmar(
    idSolicitud: number,
    usuario: AuthenticatedUser,
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
        capacidadLaboratorio: laboratorio.capacidad,
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
            motivoRechazo: `Rechazo automático del sistema: ${disponibilidad.motivo}`,
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
        motivoRechazo: dto.motivo,
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

    return actualizada;
  }

  // ───────────────────────── lecturas ─────────────────────────

  async findMias(usuario: AuthenticatedUser): Promise<SolicitudReserva[]> {
    return this.solicitudRepository.find({
      where: { idSolicitante: usuario.id },
      relations: { firmas: true },
      order: { fechaCreacion: 'DESC' },
    });
  }

  async findPendientesDeMiFirma(
    usuario: AuthenticatedUser,
  ): Promise<SolicitudReserva[]> {
    if (usuario.rol === 'docente') {
      return this.solicitudRepository.find({
        where: {
          estado: EstadoSolicitud.PENDIENTE_DOCENTE,
          idDocenteEncargado: usuario.id,
        },
        relations: { firmas: true },
        order: { fechaCreacion: 'ASC' },
      });
    }
    if (usuario.rol === 'laboratorista') {
      return this.solicitudRepository.find({
        where: { estado: EstadoSolicitud.PENDIENTE_LABORATORISTA },
        relations: { firmas: true },
        order: { fechaCreacion: 'ASC' },
      });
    }
    return [];
  }

  async findOne(
    idSolicitud: number,
    usuario: AuthenticatedUser,
  ): Promise<SolicitudReserva> {
    const solicitud = await this.solicitudRepository.findOne({
      where: { idSolicitud },
      relations: { firmas: true },
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

  async findAll(filtros: FiltrosSolicitudes): Promise<SolicitudReserva[]> {
    return this.solicitudRepository.find({
      where: {
        ...(filtros.estado && { estado: filtros.estado }),
        ...(filtros.idLaboratorio && { idLaboratorio: filtros.idLaboratorio }),
        ...(filtros.idPeriodo && { idPeriodo: filtros.idPeriodo }),
      },
      relations: { firmas: true },
      order: { fechaCreacion: 'DESC' },
    });
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
    }));

    const solicitudes = await this.solicitudRepository.find({
      where: {
        idLaboratorio,
        fechaPractica: fecha,
        estado: EstadoSolicitud.APROBADA,
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
        capacidad: laboratorio.capacidad,
      }),
    }));

    return [...bloquesHorario, ...bloquesSolicitudes];
  }
}
