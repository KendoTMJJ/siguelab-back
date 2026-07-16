import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EspacioAcademico } from 'src/catalogos/entities/espacio-academico.entity';
import { EspacioLaboratorio } from '../entities/espacio-laboratorio.entity';
import { EstadoLaboratorio, Laboratorio } from '../entities/laboratorio.entity';
import { LaboratoriosService } from './laboratorios.service';

@Injectable()
export class EspaciosLaboratorioService {
  private readonly espacioLaboratorioRepository: Repository<EspacioLaboratorio>;
  private readonly espacioAcademicoRepository: Repository<EspacioAcademico>;
  private readonly laboratorioRepository: Repository<Laboratorio>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly laboratoriosService: LaboratoriosService,
  ) {
    this.espacioLaboratorioRepository =
      this.dataSource.getRepository(EspacioLaboratorio);
    this.espacioAcademicoRepository =
      this.dataSource.getRepository(EspacioAcademico);
    this.laboratorioRepository = this.dataSource.getRepository(Laboratorio);
  }

  private async validarEspacio(idEspacio: number): Promise<void> {
    const espacio = await this.espacioAcademicoRepository.findOne({
      where: { idEspacio },
    });
    if (!espacio) {
      throw new HttpException(
        'Espacio académico no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  /** El eslabón de filtrado: laboratorios activos y no eliminados asociados a un espacio. */
  async laboratoriosDeEspacio(idEspacio: number): Promise<Laboratorio[]> {
    await this.validarEspacio(idEspacio);

    const asociaciones = await this.espacioLaboratorioRepository.find({
      where: { idEspacio },
    });
    if (asociaciones.length === 0) {
      return [];
    }

    return this.laboratorioRepository.find({
      where: asociaciones.map((a) => ({
        idLaboratorio: a.idLaboratorio,
        estado: EstadoLaboratorio.ACTIVO,
      })),
      order: { nombre: 'ASC' },
    });
  }

  /** Vista inversa para admin: espacios asociados a un laboratorio. */
  async espaciosDeLaboratorio(
    idLaboratorio: number,
  ): Promise<EspacioAcademico[]> {
    await this.laboratoriosService.findOne(idLaboratorio);

    const asociaciones = await this.espacioLaboratorioRepository.find({
      where: { idLaboratorio },
    });
    if (asociaciones.length === 0) {
      return [];
    }

    return this.espacioAcademicoRepository.find({
      where: asociaciones.map((a) => ({ idEspacio: a.idEspacio })),
      order: { nombre: 'ASC' },
    });
  }

  async asociar(
    idLaboratorio: number,
    idEspacio: number,
  ): Promise<EspacioLaboratorio> {
    await this.laboratoriosService.validarDisponibleParaAsociar(idLaboratorio);
    await this.validarEspacio(idEspacio);

    const existente = await this.espacioLaboratorioRepository.findOne({
      where: { idLaboratorio, idEspacio },
    });
    if (existente) {
      throw new HttpException(
        'El espacio ya está asociado a este laboratorio',
        HttpStatus.CONFLICT,
      );
    }

    const asociacion = this.espacioLaboratorioRepository.create({
      idLaboratorio,
      idEspacio,
    });
    return this.espacioLaboratorioRepository.save(asociacion);
  }

  async desasociar(idLaboratorio: number, idEspacio: number): Promise<void> {
    const existente = await this.espacioLaboratorioRepository.findOne({
      where: { idLaboratorio, idEspacio },
    });
    if (!existente) {
      throw new HttpException(
        'El espacio no está asociado a este laboratorio',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.espacioLaboratorioRepository.remove(existente);
  }
}
