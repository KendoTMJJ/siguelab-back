import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, ILike, Repository } from 'typeorm';
import { Division } from '../entities/division.entity';
import { Facultad } from '../entities/facultad.entity';
import { CreateDivisionDto } from '../dto/division/create-division.dto';
import { UpdateDivisionDto } from '../dto/division/update-division.dto';

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

  async create(createDivisionDto: CreateDivisionDto): Promise<Division> {
    if (await this.existeActivaConNombre(createDivisionDto.nombre)) {
      throw new HttpException('La división ya existe', HttpStatus.CONFLICT);
    }

    try {
      const division = this.divisionRepository.create(createDivisionDto);
      return await this.divisionRepository.save(division);
    } catch {
      throw new HttpException(
        'Error al crear la división',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  findAll(buscar?: string): Promise<Division[]> {
    return this.divisionRepository.find({
      ...(buscar && { where: { nombre: ILike(`%${buscar}%`) } }),
      order: { nombre: 'ASC' },
    });
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
