import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import type { AuthenticatedUser } from 'src/auth/decorators/current-user.decorator';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';
import { TipoReserva } from 'src/catalogos/entities/tipo-reserva.entity';
import {
  EstadoSolicitud,
  SolicitudReserva,
} from 'src/solicitudes/entities/solicitud-reserva.entity';
import { ResultadoFirma } from 'src/solicitudes/entities/firma.entity';
import { SolicitudesService } from 'src/solicitudes/solicitudes.service';
import { CONDICION_CANCELADA_TRAS_APROBACION } from 'src/solicitudes/utils/cancelada-tras-aprobacion.util';
import { RegistroUso } from './entities/registro-uso.entity';
import { CreateRegistroUsoDto } from './dto/create-registro-uso.dto';
import { UpdateRegistroUsoDto } from './dto/update-registro-uso.dto';
import {
  PaginatedResult,
  buildPaginatedResult,
} from 'src/common/pagination/paginated-result.interface';
import { PaginationParams } from 'src/common/pagination/pagination.util';

export interface FiltrosBitacora {
  idLaboratorio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  idPeriodo?: number;
  /** Contiene, sin distinguir mayúsculas, contra el nombre de la práctica de
   * la solicitud enlazada — los registros sin solicitud (usos sin reserva)
   * no tienen nombre de práctica, así que nunca coinciden con esto. */
  buscar?: string;
}

@Injectable()
export class BitacoraService {
  private readonly registroUsoRepository: Repository<RegistroUso>;
  private readonly solicitudRepository: Repository<SolicitudReserva>;
  private readonly laboratorioRepository: Repository<Laboratorio>;
  private readonly tipoReservaRepository: Repository<TipoReserva>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly solicitudesService: SolicitudesService,
  ) {
    this.registroUsoRepository = this.dataSource.getRepository(RegistroUso);
    this.solicitudRepository = this.dataSource.getRepository(SolicitudReserva);
    this.laboratorioRepository = this.dataSource.getRepository(Laboratorio);
    this.tipoReservaRepository = this.dataSource.getRepository(TipoReserva);
  }

  async create(
    dto: CreateRegistroUsoDto,
    laboratorista: AuthenticatedUser,
  ): Promise<RegistroUso> {
    const laboratorio = await this.laboratorioRepository.findOne({
      where: { idLaboratorio: dto.idLaboratorio },
    });
    if (!laboratorio) {
      throw new HttpException(
        'Laboratorio no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    const tipoReserva = await this.tipoReservaRepository.findOne({
      where: { idTipo: dto.idTipo },
    });
    if (!tipoReserva) {
      throw new HttpException(
        'Tipo de reserva no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    let solicitud: SolicitudReserva | null = null;
    if (dto.idSolicitud) {
      solicitud = await this.solicitudRepository.findOne({
        where: { idSolicitud: dto.idSolicitud },
        relations: { firmas: true },
      });
      if (!solicitud) {
        throw new HttpException(
          'Solicitud no encontrada',
          HttpStatus.NOT_FOUND,
        );
      }
      // Una CANCELADA que llegó a estar aprobada (todas sus firmas quedaron
      // en aprobada — ver CONDICION_CANCELADA_TRAS_APROBACION) también se
      // puede registrar: el laboratorio siguió bloqueado hasta la fecha
      // aunque el estudiante haya cancelado, así que igual hace falta un
      // cierre en bitácora. Una cancelada que nunca llegó a aprobarse (o
      // una rechazada) no aplica:
      // ahí nunca hubo nada bloqueado que cerrar.
      const fueAprobada =
        solicitud.firmas.length > 0 &&
        solicitud.firmas.every((f) => f.resultado === ResultadoFirma.APROBADA);
      const puedeRegistrar =
        solicitud.estado === EstadoSolicitud.APROBADA ||
        (solicitud.estado === EstadoSolicitud.CANCELADA && fueAprobada);
      if (!puedeRegistrar) {
        throw new HttpException(
          'La solicitud debe estar aprobada (o cancelada después de estarlo) para registrar bitácora',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (solicitud.idLaboratorio !== dto.idLaboratorio) {
        throw new HttpException(
          'La solicitud no corresponde a este laboratorio',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (dto.horaFinReal <= dto.horaInicioReal) {
      throw new HttpException(
        'La hora de fin debe ser posterior a la hora de inicio',
        HttpStatus.BAD_REQUEST,
      );
    }

    const registro = this.registroUsoRepository.create({
      idSolicitud: dto.idSolicitud ?? null,
      idLaboratorio: dto.idLaboratorio,
      idLaboratorista: laboratorista.id,
      idTipo: dto.idTipo,
      fecha: dto.fecha,
      horaInicioReal: dto.horaInicioReal,
      horaFinReal: dto.horaFinReal,
      numAsistentes: dto.numAsistentes ?? 0,
      observaciones: dto.observaciones ?? null,
      usoLaboratorio: dto.usoLaboratorio,
    });

    const guardado = await this.registroUsoRepository.save(registro);

    // Cierra el flujo de la solicitud: antes de esto una solicitud aprobada
    // se quedaba "aprobada" para siempre — ver SolicitudesService.marcarRealizada.
    // Solo si SIGUE aprobada: una que ya está cancelada (ver arriba) queda
    // tal cual — registrar bitácora ahí es cerrar el porqué (las
    // observaciones), no marcar que la práctica sí ocurrió.
    if (dto.idSolicitud && solicitud?.estado === EstadoSolicitud.APROBADA) {
      await this.solicitudesService.marcarRealizada(
        dto.idSolicitud,
        laboratorista.id,
      );
    }

    return guardado;
  }

  /** registro_uso no tiene relación 1-a-N propia en el select (todas las
   * relaciones que trae son N-a-1: laboratorio, tipoReserva, laboratorista,
   * solicitud), así que a diferencia del historial de solicitudes aquí sí es
   * seguro paginar con skip/take directamente sobre el query con joins. */
  async findAll(
    filtros: FiltrosBitacora,
    pagination: PaginationParams,
    usuario: AuthenticatedUser,
  ): Promise<PaginatedResult<RegistroUso>> {
    const query = this.registroUsoRepository
      .createQueryBuilder('registro')
      .leftJoinAndSelect('registro.laboratorio', 'laboratorio')
      .leftJoinAndSelect('registro.tipoReserva', 'tipoReserva')
      .leftJoinAndSelect('registro.laboratorista', 'laboratorista')
      .leftJoinAndSelect('registro.solicitud', 'solicitud')
      .orderBy('registro.fecha', 'DESC')
      .addOrderBy('registro.idRegistro', 'DESC');

    // Docente/laboratorista ven solo su propia actividad; admin ve todo
    // (mismo criterio que Historial/Estadísticas).
    if (usuario.rol === 'docente') {
      query.andWhere('solicitud.id_docente_encargado = :idUsuario', {
        idUsuario: usuario.id,
      });
    } else if (usuario.rol === 'laboratorista') {
      query.andWhere('registro.id_laboratorista = :idUsuario', {
        idUsuario: usuario.id,
      });
    }

    if (filtros.idLaboratorio) {
      query.andWhere('registro.id_laboratorio = :idLaboratorio', {
        idLaboratorio: filtros.idLaboratorio,
      });
    }
    if (filtros.fechaDesde) {
      query.andWhere('registro.fecha >= :fechaDesde', {
        fechaDesde: filtros.fechaDesde,
      });
    }
    if (filtros.fechaHasta) {
      query.andWhere('registro.fecha <= :fechaHasta', {
        fechaHasta: filtros.fechaHasta,
      });
    }
    if (filtros.idPeriodo) {
      // La solicitud ya está unida arriba (leftJoinAndSelect) — se reusa el
      // mismo alias en vez de un innerJoin aparte.
      query.andWhere('solicitud.id_periodo = :idPeriodo', {
        idPeriodo: filtros.idPeriodo,
      });
    }
    if (filtros.buscar) {
      query.andWhere('LOWER(solicitud.nombre_practica) LIKE LOWER(:buscar)', {
        buscar: `%${filtros.buscar}%`,
      });
    }

    const [data, total] = await query
      .skip(pagination.skip)
      .take(pagination.take)
      .getManyAndCount();

    return buildPaginatedResult(data, total, pagination.page, pagination.limit);
  }

  /**
   * Solicitudes aprobadas que TODAVÍA no tienen un registro de bitácora —
   * antes esto se calculaba en el front cruzando GET /solicitudes?estado=aprobada
   * completo contra GET /bitacora completo (dos tablas enteras en memoria del
   * cliente). Acá es un anti-join server-side (NOT EXISTS), paginado, que
   * nunca trae más filas que las de la página pedida.
   */
  /**
   * Igual que SolicitudesService.findAll: paginado en dos pasos. No es por
   * el join 1-a-N aquí (no hay ninguno en esta consulta) sino porque esta
   * versión de TypeORM no soporta un ORDER BY con subconsulta SQL cruda en
   * una query que hidrata entidades (getMany/getManyAndCount fallan con
   * "alias was not found" — ver createOrderByCombinedWithSelectExpression).
   * Primero se resuelven los ids ya ordenados y paginados con una query
   * "raw" (getRawMany, sin hidratar entidades — ahí sí funciona el orderBy
   * crudo), y luego se cargan esos ids con sus relaciones, reordenando en
   * JS según la posición que ya trae `ids`.
   */
  async pendientesPorRegistrar(
    pagination: PaginationParams,
    idLaboratorio?: number,
    fechaDesde?: string,
    fechaHasta?: string,
    buscar?: string,
  ): Promise<PaginatedResult<SolicitudReserva>> {
    const idQuery = this.solicitudRepository
      .createQueryBuilder('solicitud')
      .select('solicitud.idSolicitud', 'idSolicitud')
      // Además de las `aprobada` sin cerrar (caso normal), también entran
      // las `cancelada` que llegaron a estar aprobadas (ver
      // CONDICION_CANCELADA_TRAS_APROBACION) una vez que ya pasó su fecha —
      // mientras no pase, el laboratorio sigue bloqueado y no hay nada que
      // cerrar todavía.
      .where(
        `(solicitud.estado = :aprobada OR (${CONDICION_CANCELADA_TRAS_APROBACION} AND solicitud.fecha_practica < CURDATE()))`,
        {
          aprobada: EstadoSolicitud.APROBADA,
          cancelada: EstadoSolicitud.CANCELADA,
          firmaAprobada: ResultadoFirma.APROBADA,
        },
      )
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM registro_uso registro WHERE registro.id_solicitud = solicitud.id_solicitud)',
      );

    if (idLaboratorio) {
      // Filtra por el laboratorio que el laboratorista tiene físicamente
      // enfrente — sin esto, si terminan varias clases de distintos
      // laboratorios a la misma hora, todas aparecen mezcladas y no hay
      // forma de saber cuál corresponde registrar primero.
      idQuery.andWhere('solicitud.idLaboratorio = :idLaboratorio', {
        idLaboratorio,
      });
    }
    if (fechaDesde) {
      idQuery.andWhere('solicitud.fechaPractica >= :fechaDesde', {
        fechaDesde,
      });
    }
    if (fechaHasta) {
      idQuery.andWhere('solicitud.fechaPractica <= :fechaHasta', {
        fechaHasta,
      });
    }
    if (buscar) {
      idQuery.andWhere('LOWER(solicitud.nombrePractica) LIKE LOWER(:buscar)', {
        buscar: `%${buscar}%`,
      });
    }

    idQuery
      // Orden por cuándo quedó aprobada (su último evento real), no por la
      // fecha de la práctica: lo que importa aquí es desde cuándo lleva
      // esperando que alguien le registre el uso, igual que en
      // SolicitudesService.findPendientesDeMiFirma — una práctica lejana
      // aprobada hace mucho no debería quedar enterrada detrás de una
      // práctica próxima aprobada recién.
      .orderBy(
        '(SELECT MAX(ev.fecha) FROM solicitud_evento ev WHERE ev.id_solicitud = solicitud.id_solicitud)',
        'ASC',
      )
      .addOrderBy('solicitud.idSolicitud', 'ASC');

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
      .leftJoinAndSelect('solicitud.laboratorio', 'laboratorio')
      .leftJoinAndSelect('solicitud.tipoReserva', 'tipoReserva')
      .leftJoin('solicitud.docenteEncargado', 'docenteEncargado')
      .addSelect(['docenteEncargado.idUsuario', 'docenteEncargado.nombre'])
      .where('solicitud.idSolicitud IN (:...ids)', { ids })
      .getMany();

    const posicion = new Map(ids.map((id, indice) => [id, indice]));
    data.sort(
      (a, b) => posicion.get(a.idSolicitud)! - posicion.get(b.idSolicitud)!,
    );

    return buildPaginatedResult(data, total, pagination.page, pagination.limit);
  }

  async findOne(id: number, usuario: AuthenticatedUser): Promise<RegistroUso> {
    const registro = await this.registroUsoRepository.findOne({
      where: { idRegistro: id },
      relations: {
        laboratorio: true,
        tipoReserva: true,
        laboratorista: true,
        solicitud: true,
      },
    });
    if (!registro) {
      throw new HttpException(
        'Registro de bitácora no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    if (
      (usuario.rol === 'docente' &&
        registro.solicitud?.idDocenteEncargado !== usuario.id) ||
      (usuario.rol === 'laboratorista' &&
        registro.idLaboratorista !== usuario.id)
    ) {
      throw new HttpException(
        'No tienes acceso a este registro',
        HttpStatus.FORBIDDEN,
      );
    }
    return registro;
  }

  /**
   * Edición ampliada a propósito (ver UpdateRegistroUsoDto): el
   * laboratorista puede corregir cualquier campo del registro, incluida
   * fecha/horas/asistentes/laboratorio/tipo, no solo observaciones.
   * `idSolicitud` no se puede reasignar; si el registro tiene una solicitud
   * enlazada, `idLaboratorio` debe seguir coincidiendo con la de esa
   * solicitud (misma regla que al crear).
   */
  async update(id: number, dto: UpdateRegistroUsoDto): Promise<RegistroUso> {
    const registro = await this.registroUsoRepository.findOne({
      where: { idRegistro: id },
      relations: { solicitud: true },
    });
    if (!registro) {
      throw new HttpException(
        'Registro de bitácora no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }

    if (dto.idLaboratorio !== undefined) {
      const laboratorio = await this.laboratorioRepository.findOne({
        where: { idLaboratorio: dto.idLaboratorio },
      });
      if (!laboratorio) {
        throw new HttpException(
          'Laboratorio no encontrado',
          HttpStatus.NOT_FOUND,
        );
      }
      if (
        registro.solicitud &&
        registro.solicitud.idLaboratorio !== dto.idLaboratorio
      ) {
        throw new HttpException(
          'La solicitud enlazada no corresponde a este laboratorio',
          HttpStatus.BAD_REQUEST,
        );
      }
      registro.idLaboratorio = dto.idLaboratorio;
    }

    if (dto.idTipo !== undefined) {
      const tipoReserva = await this.tipoReservaRepository.findOne({
        where: { idTipo: dto.idTipo },
      });
      if (!tipoReserva) {
        throw new HttpException(
          'Tipo de reserva no encontrado',
          HttpStatus.NOT_FOUND,
        );
      }
      registro.idTipo = dto.idTipo;
    }

    const horaInicioFinal = dto.horaInicioReal ?? registro.horaInicioReal;
    const horaFinFinal = dto.horaFinReal ?? registro.horaFinReal;
    if (horaFinFinal <= horaInicioFinal) {
      throw new HttpException(
        'La hora de fin debe ser posterior a la hora de inicio',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.fecha !== undefined) {
      registro.fecha = dto.fecha;
    }
    if (dto.horaInicioReal !== undefined) {
      registro.horaInicioReal = dto.horaInicioReal;
    }
    if (dto.horaFinReal !== undefined) {
      registro.horaFinReal = dto.horaFinReal;
    }
    if (dto.numAsistentes !== undefined) {
      registro.numAsistentes = dto.numAsistentes;
    }
    if (dto.observaciones !== undefined) {
      registro.observaciones = dto.observaciones;
    }
    if (dto.usoLaboratorio !== undefined) {
      registro.usoLaboratorio = dto.usoLaboratorio;
    }

    return this.registroUsoRepository.save(registro);
  }
}
