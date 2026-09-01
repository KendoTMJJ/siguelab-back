import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { LaboratoriosService } from 'src/laboratorios/services/laboratorios.service';
import { Equipo } from 'src/equipos-laboratorio/entities/equipo.entity';
import { Servicio, EstadoServicio } from './entities/servicio.entity';
import { CreateServicioDto } from './dto/create-servicio.dto';
import { UpdateServicioDto } from './dto/update-servicio.dto';

export interface FiltrosServiciosCatalogo {
  idLaboratorio?: number;
  incluirInactivos?: boolean;
}

@Injectable()
export class ServiciosService {
  private readonly servicioRepository: Repository<Servicio>;
  private readonly equipoRepository: Repository<Equipo>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly laboratoriosService: LaboratoriosService,
  ) {
    this.servicioRepository = this.dataSource.getRepository(Servicio);
    this.equipoRepository = this.dataSource.getRepository(Equipo);
  }

  async create(dto: CreateServicioDto): Promise<Servicio> {
    await this.laboratoriosService.findOne(dto.idLaboratorio);
    const servicio = this.servicioRepository.create(dto);
    return this.servicioRepository.save(servicio);
  }

  async findAll(filtros: FiltrosServiciosCatalogo): Promise<Servicio[]> {
    return this.servicioRepository.find({
      where: {
        ...(filtros.idLaboratorio && { idLaboratorio: filtros.idLaboratorio }),
        ...(!filtros.incluirInactivos && { estado: EstadoServicio.ACTIVO }),
      },
      // Más reciente primero: sin paginar, así el que se acaba de crear
      // queda arriba de todo en vez de perderse en medio del alfabeto.
      order: { fechaCreacion: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Servicio> {
    const servicio = await this.servicioRepository.findOne({
      where: { idServicio: id },
    });
    if (!servicio) {
      throw new HttpException('Servicio no encontrado', HttpStatus.NOT_FOUND);
    }
    return servicio;
  }

  /** Los equipos que cuelgan de este servicio (ej. las 5 impresoras de
   * "Impresión 3D") — el catálogo puede tener servicios sin ningún equipo
   * (ej. "Diseño"), eso es válido y devuelve un arreglo vacío. */
  async equiposDe(id: number): Promise<Equipo[]> {
    await this.findOne(id);
    return this.equipoRepository.find({
      where: { idServicio: id },
      order: { nombre: 'ASC' },
    });
  }

  async update(id: number, dto: UpdateServicioDto): Promise<Servicio> {
    const servicio = await this.servicioRepository.preload({
      idServicio: id,
      ...dto,
    });
    if (!servicio) {
      throw new HttpException('Servicio no encontrado', HttpStatus.NOT_FOUND);
    }
    return this.servicioRepository.save(servicio);
  }

  /** Desactivar: no borra nada, solo deja de ofrecerse en nuevas
   * solicitudes/equipos — las solicitudes históricas que ya lo apuntan
   * siguen intactas. Para un borrado real, ver eliminar(). */
  async remove(id: number): Promise<Servicio> {
    return this.update(id, { estado: EstadoServicio.INACTIVO });
  }

  /**
   * Borrado real (soft delete, igual que Laboratorio) — el registro sigue
   * existiendo para que las solicitudes históricas no se rompan (softRemove
   * solo marca fecha_eliminacion, no borra la fila), pero desaparece de
   * findAll/findOne igual que un laboratorio eliminado. Bloqueado si tiene
   * equipos asociados: si no, esos equipos quedarían apuntando a un
   * servicio invisible en vez de reasignarlos o borrarlos primero.
   */
  async eliminar(id: number): Promise<void> {
    const servicio = await this.findOne(id);
    const tieneEquipos = await this.equipoRepository.exists({
      where: { idServicio: id },
    });
    if (tieneEquipos) {
      throw new HttpException(
        'No se puede eliminar: hay equipos asociados a este servicio. Reasígnalos o elimínalos primero.',
        HttpStatus.CONFLICT,
      );
    }
    await this.servicioRepository.softRemove(servicio);
  }

  async restaurar(id: number): Promise<Servicio> {
    const servicio = await this.servicioRepository.findOne({
      where: { idServicio: id },
      withDeleted: true,
    });
    if (!servicio) {
      throw new HttpException('Servicio no encontrado', HttpStatus.NOT_FOUND);
    }
    if (!servicio.fechaEliminacion) {
      throw new HttpException(
        'El servicio no está eliminado',
        HttpStatus.CONFLICT,
      );
    }
    await this.servicioRepository.restore(id);
    return this.findOne(id);
  }
}
