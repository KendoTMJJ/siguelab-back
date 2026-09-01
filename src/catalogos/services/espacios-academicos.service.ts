import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EspacioAcademico } from '../entities/espacio-academico.entity';
import { CreateEspacioAcademicoDto } from '../dto/espacio-academico/create-espacio-academico.dto';
import { UpdateEspacioAcademicoDto } from '../dto/espacio-academico/update-espacio-academico.dto';
import {
  PaginatedResult,
  buildPaginatedResult,
} from 'src/common/pagination/paginated-result.interface';
import { PaginationParams } from 'src/common/pagination/pagination.util';

@Injectable()
export class EspaciosAcademicosService {
  private readonly espacioRepository: Repository<EspacioAcademico>;

  constructor(private readonly dataSource: DataSource) {
    this.espacioRepository = this.dataSource.getRepository(EspacioAcademico);
  }

  private async existeActivoConNombre(
    nombre: string,
    idExcluido?: number,
  ): Promise<boolean> {
    const existente = await this.espacioRepository.findOne({
      where: { nombre },
    });
    return !!existente && existente.idEspacio !== idExcluido;
  }

  /** Ver comentario equivalente en DivisionesService.limpiar. */
  private limpiar(espacio: EspacioAcademico): EspacioAcademico {
    delete (espacio as Partial<EspacioAcademico>).nombreActivo;
    return espacio;
  }

  async create(
    createEspacioAcademicoDto: CreateEspacioAcademicoDto,
  ): Promise<EspacioAcademico> {
    if (await this.existeActivoConNombre(createEspacioAcademicoDto.nombre)) {
      throw new HttpException(
        'Ya existe un espacio académico con ese nombre',
        HttpStatus.CONFLICT,
      );
    }

    try {
      const espacio = this.espacioRepository.create(createEspacioAcademicoDto);
      return this.limpiar(await this.espacioRepository.save(espacio));
    } catch {
      throw new HttpException(
        'Error al crear el espacio académico',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** Modo dual: ver comentario equivalente en DivisionesService.findAll. */
  findAll(buscar?: string): Promise<EspacioAcademico[]>;
  findAll(
    buscar: string | undefined,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<EspacioAcademico>>;
  async findAll(
    buscar?: string,
    pagination?: PaginationParams,
  ): Promise<EspacioAcademico[] | PaginatedResult<EspacioAcademico>> {
    const query = this.espacioRepository
      .createQueryBuilder('espacio')
      .orderBy('espacio.fechaCreacion', 'DESC');

    if (buscar) {
      query.andWhere('LOWER(espacio.nombre) LIKE LOWER(:buscar)', {
        buscar: `%${buscar}%`,
      });
    }

    if (!pagination) {
      const espacios = await query.getMany();
      return espacios.map((e) => this.limpiar(e));
    }

    const [data, total] = await query
      .skip(pagination.skip)
      .take(pagination.take)
      .getManyAndCount();
    return buildPaginatedResult(
      data.map((e) => this.limpiar(e)),
      total,
      pagination.page,
      pagination.limit,
    );
  }

  async findOne(id: number): Promise<EspacioAcademico> {
    const espacio = await this.espacioRepository.findOne({
      where: { idEspacio: id },
    });
    if (!espacio) {
      throw new HttpException(
        'Espacio académico no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.limpiar(espacio);
  }

  async update(
    id: number,
    updateEspacioAcademicoDto: UpdateEspacioAcademicoDto,
  ): Promise<EspacioAcademico> {
    await this.findOne(id);

    if (
      updateEspacioAcademicoDto.nombre &&
      (await this.existeActivoConNombre(updateEspacioAcademicoDto.nombre, id))
    ) {
      throw new HttpException(
        'Ya existe un espacio académico con ese nombre',
        HttpStatus.CONFLICT,
      );
    }

    try {
      const espacio = await this.espacioRepository.preload({
        idEspacio: id,
        ...updateEspacioAcademicoDto,
      });
      return this.limpiar(await this.espacioRepository.save(espacio!));
    } catch {
      throw new HttpException(
        'Error al actualizar el espacio académico',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: number): Promise<void> {
    const espacio = await this.findOne(id);
    await this.espacioRepository.softRemove(espacio);
  }

  async restaurar(id: number): Promise<EspacioAcademico> {
    const espacio = await this.espacioRepository.findOne({
      where: { idEspacio: id },
      withDeleted: true,
    });
    if (!espacio) {
      throw new HttpException(
        'Espacio académico no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!espacio.fechaEliminacion) {
      throw new HttpException(
        'El espacio académico no está eliminado',
        HttpStatus.CONFLICT,
      );
    }
    if (await this.existeActivoConNombre(espacio.nombre, id)) {
      throw new HttpException(
        'Ya existe un espacio académico activo con ese nombre',
        HttpStatus.CONFLICT,
      );
    }

    await this.espacioRepository.restore(id);
    return this.findOne(id);
  }
}
