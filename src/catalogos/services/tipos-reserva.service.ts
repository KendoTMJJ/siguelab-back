import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TipoReserva } from '../entities/tipo-reserva.entity';
import { CreateTipoReservaDto } from '../dto/tipo-reserva/create-tipo-reserva.dto';
import { UpdateTipoReservaDto } from '../dto/tipo-reserva/update-tipo-reserva.dto';

@Injectable()
export class TiposReservaService {
  private readonly tipoReservaRepository: Repository<TipoReserva>;

  constructor(private readonly dataSource: DataSource) {
    this.tipoReservaRepository = this.dataSource.getRepository(TipoReserva);
  }

  private async existeActivoConNombre(
    nombre: string,
    idExcluido?: number,
  ): Promise<boolean> {
    const existente = await this.tipoReservaRepository.findOne({
      where: { nombre },
    });
    return !!existente && existente.idTipo !== idExcluido;
  }

  /** Ver comentario equivalente en DivisionesService.limpiar. */
  private limpiar(tipoReserva: TipoReserva): TipoReserva {
    delete (tipoReserva as Partial<TipoReserva>).nombreActivo;
    return tipoReserva;
  }

  async create(
    createTipoReservaDto: CreateTipoReservaDto,
  ): Promise<TipoReserva> {
    if (await this.existeActivoConNombre(createTipoReservaDto.nombre)) {
      throw new HttpException(
        'El tipo de reserva ya existe',
        HttpStatus.CONFLICT,
      );
    }

    try {
      const tipoReserva =
        this.tipoReservaRepository.create(createTipoReservaDto);
      return this.limpiar(await this.tipoReservaRepository.save(tipoReserva));
    } catch {
      throw new HttpException(
        'Error al crear el tipo de reserva',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async findAll(): Promise<TipoReserva[]> {
    const tipos = await this.tipoReservaRepository.find({
      order: { nombre: 'ASC' },
    });
    return tipos.map((t) => this.limpiar(t));
  }

  async findOne(id: number): Promise<TipoReserva> {
    const tipoReserva = await this.tipoReservaRepository.findOne({
      where: { idTipo: id },
    });
    if (!tipoReserva) {
      throw new HttpException(
        'Tipo de reserva no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.limpiar(tipoReserva);
  }

  async update(
    id: number,
    updateTipoReservaDto: UpdateTipoReservaDto,
  ): Promise<TipoReserva> {
    await this.findOne(id);

    if (
      updateTipoReservaDto.nombre &&
      (await this.existeActivoConNombre(updateTipoReservaDto.nombre, id))
    ) {
      throw new HttpException(
        'El tipo de reserva ya existe',
        HttpStatus.CONFLICT,
      );
    }

    try {
      const tipoReserva = await this.tipoReservaRepository.preload({
        idTipo: id,
        ...updateTipoReservaDto,
      });
      return this.limpiar(await this.tipoReservaRepository.save(tipoReserva!));
    } catch {
      throw new HttpException(
        'Error al actualizar el tipo de reserva',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: number): Promise<void> {
    const tipoReserva = await this.findOne(id);
    await this.tipoReservaRepository.softRemove(tipoReserva);
  }

  async restaurar(id: number): Promise<TipoReserva> {
    const tipoReserva = await this.tipoReservaRepository.findOne({
      where: { idTipo: id },
      withDeleted: true,
    });
    if (!tipoReserva) {
      throw new HttpException(
        'Tipo de reserva no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!tipoReserva.fechaEliminacion) {
      throw new HttpException(
        'El tipo de reserva no está eliminado',
        HttpStatus.CONFLICT,
      );
    }
    if (await this.existeActivoConNombre(tipoReserva.nombre, id)) {
      throw new HttpException(
        'Ya existe un tipo de reserva activo con ese nombre',
        HttpStatus.CONFLICT,
      );
    }

    await this.tipoReservaRepository.restore(id);
    return this.findOne(id);
  }
}
