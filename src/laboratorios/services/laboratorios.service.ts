import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, ILike, Repository } from 'typeorm';
import { EstadoLaboratorio, Laboratorio } from '../entities/laboratorio.entity';
import { CreateLaboratorioDto } from '../dto/laboratorio/create-laboratorio.dto';
import { UpdateLaboratorioDto } from '../dto/laboratorio/update-laboratorio.dto';

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

  async create(
    createLaboratorioDto: CreateLaboratorioDto,
  ): Promise<Laboratorio> {
    if (await this.existeActivoConNombre(createLaboratorioDto.nombre)) {
      throw new HttpException(
        'Ya existe un laboratorio con ese nombre',
        HttpStatus.CONFLICT,
      );
    }

    try {
      const laboratorio =
        this.laboratorioRepository.create(createLaboratorioDto);
      return this.limpiar(await this.laboratorioRepository.save(laboratorio));
    } catch {
      throw new HttpException(
        'Error al crear el laboratorio',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAll(
    filtros: FiltrosLaboratorios,
    esAdmin: boolean,
  ): Promise<Laboratorio[]> {
    const usaFiltrosAdmin =
      esAdmin && (!!filtros.estado || !!filtros.incluirInactivos);
    const filtroNombre = filtros.buscar
      ? { nombre: ILike(`%${filtros.buscar}%`) }
      : {};

    let laboratorios: Laboratorio[];
    if (!usaFiltrosAdmin) {
      laboratorios = await this.laboratorioRepository.find({
        where: { estado: EstadoLaboratorio.ACTIVO, ...filtroNombre },
        order: { nombre: 'ASC' },
      });
    } else if (filtros.incluirInactivos) {
      laboratorios = await this.laboratorioRepository.find({
        where: { ...filtroNombre },
        order: { nombre: 'ASC' },
      });
    } else {
      laboratorios = await this.laboratorioRepository.find({
        where: { estado: filtros.estado, ...filtroNombre },
        order: { nombre: 'ASC' },
      });
    }
    return laboratorios.map((l) => this.limpiar(l));
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
    await this.findOne(id);

    if (
      updateLaboratorioDto.nombre &&
      (await this.existeActivoConNombre(updateLaboratorioDto.nombre, id))
    ) {
      throw new HttpException(
        'Ya existe un laboratorio con ese nombre',
        HttpStatus.CONFLICT,
      );
    }

    try {
      const laboratorio = await this.laboratorioRepository.preload({
        idLaboratorio: id,
        ...updateLaboratorioDto,
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
