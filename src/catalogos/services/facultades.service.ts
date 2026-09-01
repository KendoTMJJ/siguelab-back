import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Division } from '../entities/division.entity';
import { Facultad } from '../entities/facultad.entity';
import { CreateFacultadDto } from '../dto/facultad/create-facultad.dto';
import { UpdateFacultadDto } from '../dto/facultad/update-facultad.dto';
import {
  PaginatedResult,
  buildPaginatedResult,
} from 'src/common/pagination/paginated-result.interface';
import { PaginationParams } from 'src/common/pagination/pagination.util';

@Injectable()
export class FacultadesService {
  private readonly facultadRepository: Repository<Facultad>;
  private readonly divisionRepository: Repository<Division>;

  constructor(private readonly dataSource: DataSource) {
    this.facultadRepository = this.dataSource.getRepository(Facultad);
    this.divisionRepository = this.dataSource.getRepository(Division);
  }

  private async validarDivision(idDivision: number): Promise<void> {
    const division = await this.divisionRepository.findOne({
      where: { idDivision },
    });
    if (!division) {
      throw new HttpException('División no encontrada', HttpStatus.NOT_FOUND);
    }
  }

  async create(createFacultadDto: CreateFacultadDto): Promise<Facultad> {
    await this.validarDivision(createFacultadDto.idDivision);

    try {
      const facultad = this.facultadRepository.create(createFacultadDto);
      return await this.facultadRepository.save(facultad);
    } catch {
      throw new HttpException(
        'Error al crear la facultad',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** Modo dual: ver comentario equivalente en DivisionesService.findAll. */
  findAll(buscar?: string): Promise<Facultad[]>;
  findAll(
    buscar: string | undefined,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Facultad>>;
  async findAll(
    buscar?: string,
    pagination?: PaginationParams,
  ): Promise<Facultad[] | PaginatedResult<Facultad>> {
    const query = this.facultadRepository
      .createQueryBuilder('facultad')
      .orderBy('facultad.fechaCreacion', 'DESC');

    if (buscar) {
      query.andWhere('LOWER(facultad.nombre) LIKE LOWER(:buscar)', {
        buscar: `%${buscar}%`,
      });
    }

    if (!pagination) {
      return query.getMany();
    }

    const [data, total] = await query
      .skip(pagination.skip)
      .take(pagination.take)
      .getManyAndCount();
    return buildPaginatedResult(data, total, pagination.page, pagination.limit);
  }

  async findOne(id: number): Promise<Facultad> {
    const facultad = await this.facultadRepository.findOne({
      where: { idFacultad: id },
    });
    if (!facultad) {
      throw new HttpException('Facultad no encontrada', HttpStatus.NOT_FOUND);
    }
    return facultad;
  }

  async update(
    id: number,
    updateFacultadDto: UpdateFacultadDto,
  ): Promise<Facultad> {
    await this.findOne(id);

    if (updateFacultadDto.idDivision) {
      await this.validarDivision(updateFacultadDto.idDivision);
    }

    try {
      const facultad = await this.facultadRepository.preload({
        idFacultad: id,
        ...updateFacultadDto,
      });
      return await this.facultadRepository.save(facultad!);
    } catch {
      throw new HttpException(
        'Error al actualizar la facultad',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** Una división debe tener siempre al menos una facultad (ver
   * CreateDivisionDto.facultades) — no se puede dejarla sin ninguna. */
  async remove(id: number): Promise<void> {
    const facultad = await this.findOne(id);

    const totalEnDivision = await this.facultadRepository.count({
      where: { idDivision: facultad.idDivision },
    });
    if (totalEnDivision <= 1) {
      throw new HttpException(
        'No se puede eliminar la última facultad de la división',
        HttpStatus.CONFLICT,
      );
    }

    await this.facultadRepository.softRemove(facultad);
  }
}
