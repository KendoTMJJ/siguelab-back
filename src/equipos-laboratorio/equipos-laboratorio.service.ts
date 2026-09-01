import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { LaboratoriosService } from 'src/laboratorios/services/laboratorios.service';
import { UPLOADS_ROOT } from 'src/config/uploads/multer.config';
import { CotizacionEquipo } from 'src/servicios-tecnologicos/entities/cotizacion-equipo.entity';
import { EstadoServicioTecnologico } from 'src/servicios-tecnologicos/entities/servicio-tecnologico.entity';
import { EventoEquipo } from 'src/eventos-laboratorio/entities/evento-equipo.entity';
import { EstadoEvento } from 'src/eventos-laboratorio/entities/evento-laboratorio.entity';
import { Equipo, EstadoEquipo } from './entities/equipo.entity';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';
import {
  PaginatedResult,
  buildPaginatedResult,
} from 'src/common/pagination/paginated-result.interface';
import { PaginationParams } from 'src/common/pagination/pagination.util';

const CARPETA_FICHA_TECNICA = 'equipos-ficha-tecnica';

export interface FiltrosEquipos {
  idLaboratorio?: number;
  incluirInactivos?: boolean;
}

const ESTADOS_ASIGNABLES_MANUALMENTE = [
  EstadoEquipo.DISPONIBLE,
  EstadoEquipo.MANTENIMIENTO,
  EstadoEquipo.FUERA_SERVICIO,
];

@Injectable()
export class EquiposLaboratorioService {
  private readonly equipoRepository: Repository<Equipo>;
  private readonly cotizacionEquipoRepository: Repository<CotizacionEquipo>;
  private readonly eventoEquipoRepository: Repository<EventoEquipo>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly laboratoriosService: LaboratoriosService,
  ) {
    this.equipoRepository = this.dataSource.getRepository(Equipo);
    this.cotizacionEquipoRepository =
      this.dataSource.getRepository(CotizacionEquipo);
    this.eventoEquipoRepository = this.dataSource.getRepository(EventoEquipo);
  }

  /** Un equipo con un servicio activo colgando de él, o incluido en un
   * evento aprobado, no se puede borrar — quedaría un proceso en curso
   * apuntando a un equipo "eliminado". */
  private async tieneUsoActivo(idEquipo: number): Promise<boolean> {
    const servicioActivo = await this.cotizacionEquipoRepository
      .createQueryBuilder('ce')
      .innerJoin(
        'cotizacion_servicio',
        'cotizacion',
        'cotizacion.id_cotizacion = ce.id_cotizacion',
      )
      .innerJoin(
        'servicio_tecnologico',
        'servicio',
        'servicio.id_servicio = cotizacion.id_servicio',
      )
      .where('ce.id_equipo = :idEquipo', { idEquipo })
      .andWhere('servicio.estado IN (:...estados)', {
        estados: [
          EstadoServicioTecnologico.PROGRAMADO,
          EstadoServicioTecnologico.EN_PROCESO,
        ],
      })
      .getExists();
    if (servicioActivo) {
      return true;
    }

    return this.eventoEquipoRepository
      .createQueryBuilder('ee')
      .innerJoin(
        'evento_laboratorio',
        'evento',
        'evento.id_evento = ee.id_evento',
      )
      .where('ee.id_equipo = :idEquipo', { idEquipo })
      .andWhere('evento.estado = :estado', { estado: EstadoEvento.APROBADO })
      .getExists();
  }

  async create(createEquipoDto: CreateEquipoDto): Promise<Equipo> {
    await this.laboratoriosService.validarDisponibleParaAsociar(
      createEquipoDto.idLaboratorio,
    );

    try {
      const equipo = this.equipoRepository.create(createEquipoDto);
      return await this.equipoRepository.save(equipo);
    } catch {
      throw new HttpException(
        'Error al crear el equipo',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Modo dual: sin `pagination` devuelve el arreglo completo (lo usan otras
   * pantallas que necesitan TODOS los equipos de un laboratorio — ej. el
   * lookup de nombres en Bandeja/Mis solicitudes, o filtrar por servicio);
   * con `pagination` devuelve `PaginatedResult`, para la pantalla de
   * administración de equipos.
   */
  findAll(filtros: FiltrosEquipos): Promise<Equipo[]>;
  findAll(
    filtros: FiltrosEquipos,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Equipo>>;
  async findAll(
    filtros: FiltrosEquipos,
    pagination?: PaginationParams,
  ): Promise<Equipo[] | PaginatedResult<Equipo>> {
    const query = this.equipoRepository
      .createQueryBuilder('equipo')
      // Más reciente primero: el que se acaba de crear queda arriba de todo
      // en vez de perderse en medio del alfabeto.
      .orderBy('equipo.fechaCreacion', 'DESC');

    if (filtros.incluirInactivos) {
      query.withDeleted();
    }
    if (filtros.idLaboratorio) {
      query.andWhere('equipo.idLaboratorio = :idLaboratorio', {
        idLaboratorio: filtros.idLaboratorio,
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

  async findOne(id: number): Promise<Equipo> {
    const equipo = await this.equipoRepository.findOne({
      where: { idEquipo: id },
    });
    if (!equipo) {
      throw new HttpException('Equipo no encontrado', HttpStatus.NOT_FOUND);
    }
    return equipo;
  }

  /** Uso interno de otros módulos (servicios/eventos): 404 si no existe, 409 si
   * no está en un estado que permita programar algo sobre él. */
  async validarDisponibleParaProgramar(id: number): Promise<Equipo> {
    const equipo = await this.findOne(id);
    if (
      equipo.estado === EstadoEquipo.MANTENIMIENTO ||
      equipo.estado === EstadoEquipo.FUERA_SERVICIO
    ) {
      throw new HttpException(
        `El equipo está en estado "${equipo.estado}" y no admite programación`,
        HttpStatus.CONFLICT,
      );
    }
    return equipo;
  }

  async update(id: number, updateEquipoDto: UpdateEquipoDto): Promise<Equipo> {
    await this.findOne(id);

    if (updateEquipoDto.idLaboratorio) {
      await this.laboratoriosService.validarDisponibleParaAsociar(
        updateEquipoDto.idLaboratorio,
      );
    }

    try {
      const equipo = await this.equipoRepository.preload({
        idEquipo: id,
        ...updateEquipoDto,
      });
      return await this.equipoRepository.save(equipo!);
    } catch {
      throw new HttpException(
        'Error al actualizar el equipo',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** Solo mantenimiento/fuera_servicio son asignables manualmente — el resto
   * de estados los deriva el módulo de servicios/eventos según el calendario. */
  async cambiarEstado(id: number, estado: EstadoEquipo): Promise<Equipo> {
    if (!ESTADOS_ASIGNABLES_MANUALMENTE.includes(estado)) {
      throw new HttpException(
        `El estado "${estado}" no es asignable manualmente`,
        HttpStatus.BAD_REQUEST,
      );
    }
    const equipo = await this.findOne(id);
    equipo.estado = estado;
    return this.equipoRepository.save(equipo);
  }

  private rutaEnDisco(nombreArchivo: string): string {
    return join(UPLOADS_ROOT, CARPETA_FICHA_TECNICA, nombreArchivo);
  }

  private borrarArchivoSiExiste(equipo: Equipo): void {
    if (!equipo.fichaTecnicaRuta) {
      return;
    }
    const ruta = this.rutaEnDisco(equipo.fichaTecnicaRuta);
    if (existsSync(ruta)) {
      unlinkSync(ruta);
    }
  }

  /** Reemplaza la ficha técnica actual (si había una, se borra del disco) por
   * el archivo recién subido. Roles admin/laboratorista, ver controller. */
  async subirFichaTecnica(
    id: number,
    archivo: Express.Multer.File,
  ): Promise<Equipo> {
    const equipo = await this.findOne(id);
    this.borrarArchivoSiExiste(equipo);

    equipo.fichaTecnicaRuta = archivo.filename;
    equipo.fichaTecnicaNombreOriginal = archivo.originalname;
    equipo.fichaTecnicaMimeType = archivo.mimetype;
    return this.equipoRepository.save(equipo);
  }

  /** Para el endpoint de descarga: 404 si el equipo no existe o no tiene
   * ficha técnica cargada, ruta absoluta en disco lista para enviar. */
  async obtenerFichaTecnica(
    id: number,
  ): Promise<{ ruta: string; nombreOriginal: string; mimeType: string }> {
    const equipo = await this.findOne(id);
    if (!equipo.fichaTecnicaRuta) {
      throw new HttpException(
        'Este equipo no tiene ficha técnica cargada',
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      ruta: this.rutaEnDisco(equipo.fichaTecnicaRuta),
      nombreOriginal: equipo.fichaTecnicaNombreOriginal!,
      mimeType: equipo.fichaTecnicaMimeType!,
    };
  }

  async eliminarFichaTecnica(id: number): Promise<Equipo> {
    const equipo = await this.findOne(id);
    this.borrarArchivoSiExiste(equipo);

    equipo.fichaTecnicaRuta = null;
    equipo.fichaTecnicaNombreOriginal = null;
    equipo.fichaTecnicaMimeType = null;
    return this.equipoRepository.save(equipo);
  }

  async remove(id: number): Promise<void> {
    const equipo = await this.findOne(id);
    if (await this.tieneUsoActivo(id)) {
      throw new HttpException(
        'El equipo tiene un servicio programado/en proceso, o un evento aprobado, no se puede eliminar',
        HttpStatus.CONFLICT,
      );
    }
    await this.equipoRepository.softRemove(equipo);
  }

  async restaurar(id: number): Promise<Equipo> {
    const equipo = await this.equipoRepository.findOne({
      where: { idEquipo: id },
      withDeleted: true,
    });
    if (!equipo) {
      throw new HttpException('Equipo no encontrado', HttpStatus.NOT_FOUND);
    }
    if (!equipo.fechaEliminacion) {
      throw new HttpException(
        'El equipo no está eliminado',
        HttpStatus.CONFLICT,
      );
    }

    await this.equipoRepository.restore(id);
    return this.findOne(id);
  }
}
