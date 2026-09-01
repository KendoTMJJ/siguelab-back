import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Division } from '../entities/division.entity';
import { Facultad } from '../entities/facultad.entity';
import { CreateDivisionDto } from '../dto/division/create-division.dto';
import { UpdateDivisionDto } from '../dto/division/update-division.dto';
import {
  PaginatedResult,
  buildPaginatedResult,
} from 'src/common/pagination/paginated-result.interface';
import { PaginationParams } from 'src/common/pagination/pagination.util';

@Injectable()
export class DivisionesService {
  private readonly divisionRepository: Repository<Division>;
  private readonly facultadRepository: Repository<Facultad>;

  constructor(private readonly dataSource: DataSource) {
    this.divisionRepository = this.dataSource.getRepository(Division);
    this.facultadRepository = this.dataSource.getRepository(Facultad);
  }

  private async existeActivaConNombre(
    nombre: string,
    idExcluido?: number,
  ): Promise<boolean> {
    const existente = await this.divisionRepository.findOne({
      where: { nombre },
    });
    return !!existente && existente.idDivision !== idExcluido;
  }

  /**
   * Una división debe tener siempre al menos una facultad (ver
   * CreateDivisionDto.facultades, ArrayMinSize(1)) — división y facultades
   * se crean en la misma transacción para no dejar una división "vacía" si
   * alguna facultad falla a mitad de camino.
   */
  async create(createDivisionDto: CreateDivisionDto): Promise<Division> {
    if (await this.existeActivaConNombre(createDivisionDto.nombre)) {
      throw new HttpException('La división ya existe', HttpStatus.CONFLICT);
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const division = await manager.save(
          manager.create(Division, { nombre: createDivisionDto.nombre }),
        );
        const facultades = createDivisionDto.facultades.map((f) =>
          manager.create(Facultad, {
            nombre: f.nombre,
            idDivision: division.idDivision,
          }),
        );
        await manager.save(facultades);
        return division;
      });
    } catch {
      throw new HttpException(
        'Error al crear la división',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Modo dual: sin `pagination` devuelve el arreglo completo (lo usan los
   * `<select>` de otras pantallas — ej. el formulario de facultades — que
   * necesitan TODAS las divisiones, no una página). Con `pagination` (el
   * admin pidió page/limit) devuelve `PaginatedResult`, para la propia
   * pantalla de administración de divisiones.
   */
  findAll(buscar?: string): Promise<Division[]>;
  findAll(
    buscar: string | undefined,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Division>>;
  async findAll(
    buscar?: string,
    pagination?: PaginationParams,
  ): Promise<Division[] | PaginatedResult<Division>> {
    const query = this.divisionRepository
      .createQueryBuilder('division')
      .orderBy('division.fechaCreacion', 'DESC');

    if (buscar) {
      query.andWhere('LOWER(division.nombre) LIKE LOWER(:buscar)', {
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

  async findOne(id: number): Promise<Division> {
    const division = await this.divisionRepository.findOne({
      where: { idDivision: id },
    });
    if (!division) {
      throw new HttpException('División no encontrada', HttpStatus.NOT_FOUND);
    }
    return division;
  }

  async findFacultades(id: number): Promise<Facultad[]> {
    await this.findOne(id);
    return this.facultadRepository.find({
      where: { idDivision: id },
      order: { nombre: 'ASC' },
    });
  }

  async update(
    id: number,
    updateDivisionDto: UpdateDivisionDto,
  ): Promise<Division> {
    await this.findOne(id);

    if (
      updateDivisionDto.nombre &&
      (await this.existeActivaConNombre(updateDivisionDto.nombre, id))
    ) {
      throw new HttpException('La división ya existe', HttpStatus.CONFLICT);
    }

    try {
      const division = await this.divisionRepository.preload({
        idDivision: id,
        ...updateDivisionDto,
      });
      return await this.divisionRepository.save(division!);
    } catch {
      throw new HttpException(
        'Error al actualizar la división',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: number): Promise<void> {
    const division = await this.findOne(id);

    const tieneFacultadesActivas = await this.facultadRepository.exists({
      where: { idDivision: id },
    });
    if (tieneFacultadesActivas) {
      throw new HttpException(
        'No se puede eliminar la división porque tiene facultades activas',
        HttpStatus.CONFLICT,
      );
    }

    await this.divisionRepository.softRemove(division);
  }
}
