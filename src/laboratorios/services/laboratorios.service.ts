import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  EstadoLaboratorio,
  Laboratorio,
  ModoReservaLaboratorio,
} from '../entities/laboratorio.entity';
import { CreateLaboratorioDto } from '../dto/laboratorio/create-laboratorio.dto';
import { UpdateLaboratorioDto } from '../dto/laboratorio/update-laboratorio.dto';
import {
  PaginatedResult,
  buildPaginatedResult,
} from 'src/common/pagination/paginated-result.interface';
import { PaginationParams } from 'src/common/pagination/pagination.util';

export interface FiltrosLaboratorios {
  estado?: EstadoLaboratorio;
  incluirInactivos?: boolean;
  buscar?: string;
}

@Injectable()
export class LaboratoriosService {
  private readonly laboratorioRepository: Repository<Laboratorio>;

  constructor(private readonly dataSource: DataSource) {
    this.laboratorioRepository = this.dataSource.getRepository(Laboratorio);
  }

  private async existeActivoConNombre(
    nombre: string,
    idExcluido?: number,
  ): Promise<boolean> {
    const existente = await this.laboratorioRepository.findOne({
      where: { nombre },
    });
    return !!existente && existente.idLaboratorio !== idExcluido;
  }

  /** Ver comentario equivalente en TiposReservaService.limpiar. */
  private limpiar(laboratorio: Laboratorio): Laboratorio {
    delete (laboratorio as Partial<Laboratorio>).nombreActivo;
    return laboratorio;
  }

  /**
   * El aforo solo tiene sentido en modo 'estandar' (cupos de SolicitudReserva)
   * — en 'laboratorio_como_servicio' la disponibilidad es por equipo
   * individual, así que se ignora aunque lo manden (nunca queda un aforo
   * stale de cuando el laboratorio era estándar). En modo 'estandar' sigue
   * siendo obligatorio, igual que antes.
   */
  private validarCapacidadPorModo(
    modo: ModoReservaLaboratorio,
    capacidad: number | null | undefined,
  ): number | null {
    if (modo === ModoReservaLaboratorio.LABORATORIO_COMO_SERVICIO) {
      return null;
    }
    if (capacidad == null) {
      throw new HttpException(
        'La capacidad es obligatoria para laboratorios en modo estándar',
        HttpStatus.BAD_REQUEST,
      );
    }
    return capacidad;
  }

  async create(
    createLaboratorioDto: CreateLaboratorioDto,
  ): Promise<Laboratorio> {
    if (await this.existeActivoConNombre(createLaboratorioDto.nombre)) {
      throw new HttpException(
        'Ya existe un laboratorio con ese nombre',
        HttpStatus.CONFLICT,
      );
    }

    const modoReserva =
      createLaboratorioDto.modoReserva ?? ModoReservaLaboratorio.ESTANDAR;
    const capacidad = this.validarCapacidadPorModo(
      modoReserva,
      createLaboratorioDto.capacidad,
    );

    try {
      const laboratorio = this.laboratorioRepository.create({
        ...createLaboratorioDto,
        modoReserva,
        capacidad,
      });
      return this.limpiar(await this.laboratorioRepository.save(laboratorio));
    } catch {
      throw new HttpException(
        'Error al crear el laboratorio',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Modo dual: ver comentario equivalente en DivisionesService.findAll — sin
   * `pagination` devuelve el arreglo completo (lo usan los `<select>` de
   * laboratorio en equipo-form, horario-form, etc.); con `pagination`
   * devuelve `PaginatedResult`, para la pantalla de administración.
   */
  findAll(
    filtros: FiltrosLaboratorios,
    esAdmin: boolean,
  ): Promise<Laboratorio[]>;
  findAll(
    filtros: FiltrosLaboratorios,
    esAdmin: boolean,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Laboratorio>>;
  async findAll(
    filtros: FiltrosLaboratorios,
    esAdmin: boolean,
    pagination?: PaginationParams,
  ): Promise<Laboratorio[] | PaginatedResult<Laboratorio>> {
    const usaFiltrosAdmin =
      esAdmin && (!!filtros.estado || !!filtros.incluirInactivos);

    const query = this.laboratorioRepository
      .createQueryBuilder('laboratorio')
      // Más reciente primero: el que se acaba de crear queda arriba de todo
      // en vez de perderse en medio del alfabeto.
      .orderBy('laboratorio.fechaCreacion', 'DESC');

    if (!usaFiltrosAdmin) {
      query.andWhere('laboratorio.estado = :estado', {
        estado: EstadoLaboratorio.ACTIVO,
      });
    } else if (!filtros.incluirInactivos && filtros.estado) {
      query.andWhere('laboratorio.estado = :estado', {
        estado: filtros.estado,
      });
    }
    // esAdmin && incluirInactivos: sin filtro de estado — trae todo.

    if (filtros.buscar) {
      query.andWhere('LOWER(laboratorio.nombre) LIKE LOWER(:buscar)', {
        buscar: `%${filtros.buscar}%`,
      });
    }

    if (!pagination) {
      const laboratorios = await query.getMany();
      return laboratorios.map((l) => this.limpiar(l));
    }

    const [data, total] = await query
      .skip(pagination.skip)
      .take(pagination.take)
      .getManyAndCount();
    return buildPaginatedResult(
      data.map((l) => this.limpiar(l)),
      total,
      pagination.page,
      pagination.limit,
    );
  }

  async findOne(id: number): Promise<Laboratorio> {
    const laboratorio = await this.laboratorioRepository.findOne({
      where: { idLaboratorio: id },
    });
    if (!laboratorio) {
      throw new HttpException(
        'Laboratorio no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.limpiar(laboratorio);
  }

  /** Uso interno de otros módulos: lanza 404 si está eliminado, 409 si inactivo. */
  async validarDisponibleParaAsociar(id: number): Promise<Laboratorio> {
    const laboratorio = await this.laboratorioRepository.findOne({
      where: { idLaboratorio: id },
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
    return laboratorio;
  }

  async update(
    id: number,
    updateLaboratorioDto: UpdateLaboratorioDto,
  ): Promise<Laboratorio> {
    const existente = await this.findOne(id);

    if (
      updateLaboratorioDto.nombre &&
      (await this.existeActivoConNombre(updateLaboratorioDto.nombre, id))
    ) {
      throw new HttpException(
        'Ya existe un laboratorio con ese nombre',
        HttpStatus.CONFLICT,
      );
    }

    const modoReserva =
      updateLaboratorioDto.modoReserva ?? existente.modoReserva;
    const capacidad = this.validarCapacidadPorModo(
      modoReserva,
      updateLaboratorioDto.capacidad ?? existente.capacidad,
    );

    try {
      const laboratorio = await this.laboratorioRepository.preload({
        idLaboratorio: id,
        ...updateLaboratorioDto,
        capacidad,
      });
      return this.limpiar(await this.laboratorioRepository.save(laboratorio!));
    } catch {
      throw new HttpException(
        'Error al actualizar el laboratorio',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: number): Promise<void> {
    const laboratorio = await this.findOne(id);
    await this.laboratorioRepository.softRemove(laboratorio);
  }

  async restaurar(id: number): Promise<Laboratorio> {
    const laboratorio = await this.laboratorioRepository.findOne({
      where: { idLaboratorio: id },
      withDeleted: true,
    });
    if (!laboratorio) {
      throw new HttpException(
        'Laboratorio no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!laboratorio.fechaEliminacion) {
      throw new HttpException(
        'El laboratorio no está eliminado',
        HttpStatus.CONFLICT,
      );
    }
    if (await this.existeActivoConNombre(laboratorio.nombre, id)) {
      throw new HttpException(
        'Ya existe un laboratorio activo con ese nombre',
        HttpStatus.CONFLICT,
      );
    }

    await this.laboratorioRepository.restore(id);
    return this.findOne(id);
  }
}
