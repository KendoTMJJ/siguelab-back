import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Division } from '../entities/division.entity';
import { Facultad } from '../entities/facultad.entity';
import { CreateFacultadDto } from '../dto/facultad/create-facultad.dto';
import { UpdateFacultadDto } from '../dto/facultad/update-facultad.dto';

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

  findAll(): Promise<Facultad[]> {
    return this.facultadRepository.find({ order: { nombre: 'ASC' } });
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

  async remove(id: number): Promise<void> {
    const facultad = await this.findOne(id);
    await this.facultadRepository.softRemove(facultad);
  }
}
