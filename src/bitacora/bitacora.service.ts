import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import type { AuthenticatedUser } from 'src/auth/decorators/current-user.decorator';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';
import { TipoReserva } from 'src/catalogos/entities/tipo-reserva.entity';
import {
  EstadoSolicitud,
  SolicitudReserva,
} from 'src/solicitudes/entities/solicitud-reserva.entity';
import { RegistroUso } from './entities/registro-uso.entity';
import { CreateRegistroUsoDto } from './dto/create-registro-uso.dto';
import { UpdateRegistroUsoDto } from './dto/update-registro-uso.dto';

export interface FiltrosBitacora {
  idLaboratorio?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  idPeriodo?: number;
  /** Si se omiten page/pageSize, se devuelven todas las filas (sin paginar) — ver findAll. */
  page?: number;
  pageSize?: number;
}

export interface PaginaRegistroUso {
  items: RegistroUso[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class BitacoraService {
  private readonly registroUsoRepository: Repository<RegistroUso>;
  private readonly solicitudRepository: Repository<SolicitudReserva>;
  private readonly laboratorioRepository: Repository<Laboratorio>;
  private readonly tipoReservaRepository: Repository<TipoReserva>;

  constructor(private readonly dataSource: DataSource) {
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

    if (dto.idSolicitud) {
      const solicitud = await this.solicitudRepository.findOne({
        where: { idSolicitud: dto.idSolicitud },
      });
      if (!solicitud) {
        throw new HttpException(
          'Solicitud no encontrada',
          HttpStatus.NOT_FOUND,
        );
      }
      if (solicitud.estado !== EstadoSolicitud.APROBADA) {
        throw new HttpException(
          'La solicitud debe estar aprobada para registrar bitácora',
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
      novedad: dto.novedad ?? null,
      observaciones: dto.observaciones ?? null,
    });

    return this.registroUsoRepository.save(registro);
  }

  /**
   * Sin `page`/`pageSize`: devuelve todo (compatibilidad con el cruce
   * "pendientes por registrar" del front, que necesita el set completo de
   * idSolicitud ya registrados, no una sola página). Con ambos: pagina.
   */
  async findAll(filtros: FiltrosBitacora): Promise<PaginaRegistroUso> {
    const query = this.registroUsoRepository
      .createQueryBuilder('registro')
      .leftJoinAndSelect('registro.laboratorio', 'laboratorio')
      .leftJoinAndSelect('registro.tipoReserva', 'tipoReserva')
      .leftJoinAndSelect('registro.laboratorista', 'laboratorista')
      .leftJoinAndSelect('registro.solicitud', 'solicitud')
      .orderBy('registro.fecha', 'DESC');

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

    if (filtros.page && filtros.pageSize) {
      query.skip((filtros.page - 1) * filtros.pageSize).take(filtros.pageSize);
    }

    const [items, total] = await query.getManyAndCount();
    return {
      items,
      total,
      page: filtros.page ?? 1,
      pageSize: filtros.pageSize ?? total,
    };
  }

  async findOne(id: number): Promise<RegistroUso> {
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
    return registro;
  }

  /**
   * Edición ampliada a propósito (ver UpdateRegistroUsoDto): el
   * laboratorista puede corregir cualquier campo del registro, incluida
   * fecha/horas/asistentes/laboratorio/tipo, no solo novedad/observaciones.
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
    if (dto.novedad !== undefined) {
      registro.novedad = dto.novedad;
    }
    if (dto.observaciones !== undefined) {
      registro.observaciones = dto.observaciones;
    }

    return this.registroUsoRepository.save(registro);
  }
}
