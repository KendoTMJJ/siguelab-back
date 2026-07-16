import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PeriodoAcademico } from '../entities/periodo-academico.entity';
import { CreatePeriodoAcademicoDto } from '../dto/periodo-academico/create-periodo-academico.dto';
import { UpdatePeriodoAcademicoDto } from '../dto/periodo-academico/update-periodo-academico.dto';

@Injectable()
export class PeriodosAcademicosService {
  private readonly periodoAcademicoRepository: Repository<PeriodoAcademico>;

  constructor(private readonly dataSource: DataSource) {
    this.periodoAcademicoRepository =
      this.dataSource.getRepository(PeriodoAcademico);
  }

  private async existeActivoConNombre(
    nombre: string,
    idExcluido?: number,
  ): Promise<boolean> {
    const existente = await this.periodoAcademicoRepository.findOne({
      where: { nombre },
    });
    return !!existente && existente.idPeriodo !== idExcluido;
  }

  private validarRangoFechas(fechaInicio: string, fechaFin: string): void {
    if (new Date(fechaFin) <= new Date(fechaInicio)) {
      throw new HttpException(
        'La fecha de fin debe ser posterior a la fecha de inicio',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** Ver comentario equivalente en DivisionesService.limpiar. */
  private limpiar(periodoAcademico: PeriodoAcademico): PeriodoAcademico {
    delete (periodoAcademico as Partial<PeriodoAcademico>).nombreActivo;
    return periodoAcademico;
  }

  async create(
    createPeriodoAcademicoDto: CreatePeriodoAcademicoDto,
  ): Promise<PeriodoAcademico> {
    this.validarRangoFechas(
      createPeriodoAcademicoDto.fechaInicio,
      createPeriodoAcademicoDto.fechaFin,
    );

    if (await this.existeActivoConNombre(createPeriodoAcademicoDto.nombre)) {
      throw new HttpException(
        'El periodo académico ya existe',
        HttpStatus.CONFLICT,
      );
    }

    try {
      const periodoAcademico = this.periodoAcademicoRepository.create(
        createPeriodoAcademicoDto,
      );
      return this.limpiar(
        await this.periodoAcademicoRepository.save(periodoAcademico),
      );
    } catch {
      throw new HttpException(
        'Error al crear el periodo académico',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAll(): Promise<PeriodoAcademico[]> {
    const periodos = await this.periodoAcademicoRepository.find({
      order: { fechaInicio: 'DESC' },
    });
    return periodos.map((p) => this.limpiar(p));
  }

  async findOne(id: number): Promise<PeriodoAcademico> {
    const periodoAcademico = await this.periodoAcademicoRepository.findOne({
      where: { idPeriodo: id },
    });
    if (!periodoAcademico) {
      throw new HttpException(
        'Periodo académico no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.limpiar(periodoAcademico);
  }

  async update(
    id: number,
    updatePeriodoAcademicoDto: UpdatePeriodoAcademicoDto,
  ): Promise<PeriodoAcademico> {
    const actual = await this.findOne(id);

    const fechaInicio =
      updatePeriodoAcademicoDto.fechaInicio ?? actual.fechaInicio;
    const fechaFin = updatePeriodoAcademicoDto.fechaFin ?? actual.fechaFin;
    if (
      updatePeriodoAcademicoDto.fechaInicio ||
      updatePeriodoAcademicoDto.fechaFin
    ) {
      this.validarRangoFechas(fechaInicio, fechaFin);
    }

    if (
      updatePeriodoAcademicoDto.nombre &&
      (await this.existeActivoConNombre(updatePeriodoAcademicoDto.nombre, id))
    ) {
      throw new HttpException(
        'El periodo académico ya existe',
        HttpStatus.CONFLICT,
      );
    }

    try {
      const periodoAcademico = await this.periodoAcademicoRepository.preload({
        idPeriodo: id,
        ...updatePeriodoAcademicoDto,
      });
      return this.limpiar(
        await this.periodoAcademicoRepository.save(periodoAcademico!),
      );
    } catch {
      throw new HttpException(
        'Error al actualizar el periodo académico',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: number): Promise<void> {
    const periodoAcademico = await this.findOne(id);
    await this.periodoAcademicoRepository.softRemove(periodoAcademico);
  }

  async restaurar(id: number): Promise<PeriodoAcademico> {
    const periodoAcademico = await this.periodoAcademicoRepository.findOne({
      where: { idPeriodo: id },
      withDeleted: true,
    });
    if (!periodoAcademico) {
      throw new HttpException(
        'Periodo académico no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!periodoAcademico.fechaEliminacion) {
      throw new HttpException(
        'El periodo académico no está eliminado',
        HttpStatus.CONFLICT,
      );
    }
    if (await this.existeActivoConNombre(periodoAcademico.nombre, id)) {
      throw new HttpException(
        'Ya existe un periodo académico activo con ese nombre',
        HttpStatus.CONFLICT,
      );
    }

    await this.periodoAcademicoRepository.restore(id);
    return this.findOne(id);
  }
}
