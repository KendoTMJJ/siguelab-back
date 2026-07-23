import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';
import { EspacioLaboratorio } from 'src/laboratorios/entities/espacio-laboratorio.entity';
import { EspacioAcademico } from 'src/catalogos/entities/espacio-academico.entity';
import { PeriodoAcademico } from 'src/catalogos/entities/periodo-academico.entity';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import {
  DiaSemana,
  EstadoHorario,
  HorarioAcademico,
} from './entities/horario-academico.entity';
import { CreateHorarioAcademicoDto } from './dto/create-horario-academico.dto';
import { UpdateHorarioAcademicoDto } from './dto/update-horario-academico.dto';

export interface FiltrosHorarios {
  idLaboratorio?: number;
  idPeriodo?: number;
  diaSemana?: DiaSemana;
}

@Injectable()
export class HorariosAcademicosService {
  private readonly horarioRepository: Repository<HorarioAcademico>;
  private readonly laboratorioRepository: Repository<Laboratorio>;
  private readonly espacioAcademicoRepository: Repository<EspacioAcademico>;
  private readonly espacioLaboratorioRepository: Repository<EspacioLaboratorio>;
  private readonly periodoAcademicoRepository: Repository<PeriodoAcademico>;
  private readonly usuarioRepository: Repository<Usuario>;

  constructor(private readonly dataSource: DataSource) {
    this.horarioRepository = this.dataSource.getRepository(HorarioAcademico);
    this.laboratorioRepository = this.dataSource.getRepository(Laboratorio);
    this.espacioAcademicoRepository =
      this.dataSource.getRepository(EspacioAcademico);
    this.espacioLaboratorioRepository =
      this.dataSource.getRepository(EspacioLaboratorio);
    this.periodoAcademicoRepository =
      this.dataSource.getRepository(PeriodoAcademico);
    this.usuarioRepository = this.dataSource.getRepository(Usuario);
  }

  private validarRangoHoras(horaInicio: string, horaFin: string): void {
    if (horaFin <= horaInicio) {
      throw new HttpException(
        'La hora de fin debe ser posterior a la hora de inicio',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async validarLaboratorio(idLaboratorio: number): Promise<void> {
    const existe = await this.laboratorioRepository.exists({
      where: { idLaboratorio },
    });
    if (!existe) {
      throw new HttpException(
        'Laboratorio no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async validarEspacio(idEspacio: number): Promise<void> {
    const existe = await this.espacioAcademicoRepository.exists({
      where: { idEspacio },
    });
    if (!existe) {
      throw new HttpException(
        'Espacio académico no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async validarPeriodo(idPeriodo: number): Promise<void> {
    const existe = await this.periodoAcademicoRepository.exists({
      where: { idPeriodo },
    });
    if (!existe) {
      throw new HttpException(
        'Periodo académico no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async validarDocente(idDocente: string): Promise<void> {
    const usuario = await this.usuarioRepository.findOne({
      where: { idUsuario: idDocente },
      relations: { rol: true },
    });
    if (!usuario) {
      throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
    }
    if (usuario.rol.nombre !== 'docente') {
      throw new HttpException(
        'El usuario debe tener rol docente',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * El horario académico declara idLaboratorio + idEspacio, pero
   * SolicitudesService valida la asociación laboratorio↔espacio contra la
   * tabla puente espacio_laboratorio (independiente, pensada para el CRUD
   * admin de EspaciosLaboratorioService). Sin esto, un horario recién creado
   * queda con un espacio "no asociado" según esa validación aunque el propio
   * horario lo especifique — se sincroniza el vínculo aquí para que ambas
   * fuentes de verdad no diverjan.
   */
  private async asegurarAsociacionEspacioLaboratorio(
    idLaboratorio: number,
    idEspacio: number,
  ): Promise<void> {
    const existente = await this.espacioLaboratorioRepository.exists({
      where: { idLaboratorio, idEspacio },
    });
    if (existente) {
      return;
    }
    const asociacion = this.espacioLaboratorioRepository.create({
      idLaboratorio,
      idEspacio,
    });
    await this.espacioLaboratorioRepository.save(asociacion);
  }

  async create(
    createHorarioAcademicoDto: CreateHorarioAcademicoDto,
  ): Promise<HorarioAcademico> {
    this.validarRangoHoras(
      createHorarioAcademicoDto.horaInicio,
      createHorarioAcademicoDto.horaFin,
    );

    await this.validarLaboratorio(createHorarioAcademicoDto.idLaboratorio);
    await this.validarEspacio(createHorarioAcademicoDto.idEspacio);
    await this.validarPeriodo(createHorarioAcademicoDto.idPeriodo);
    if (createHorarioAcademicoDto.idDocente) {
      await this.validarDocente(createHorarioAcademicoDto.idDocente);
    }

    await this.asegurarAsociacionEspacioLaboratorio(
      createHorarioAcademicoDto.idLaboratorio,
      createHorarioAcademicoDto.idEspacio,
    );

    try {
      const horario = this.horarioRepository.create(createHorarioAcademicoDto);
      return await this.horarioRepository.save(horario);
    } catch {
      throw new HttpException(
        'Error al crear el horario académico',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  findAll(filtros: FiltrosHorarios): Promise<HorarioAcademico[]> {
    return this.horarioRepository.find({
      where: {
        estado: EstadoHorario.VIGENTE,
        ...(filtros.idLaboratorio && {
          idLaboratorio: filtros.idLaboratorio,
        }),
        ...(filtros.idPeriodo && { idPeriodo: filtros.idPeriodo }),
        ...(filtros.diaSemana && { diaSemana: filtros.diaSemana }),
      },
      order: { diaSemana: 'ASC', horaInicio: 'ASC' },
    });
  }

  async findOne(id: number): Promise<HorarioAcademico> {
    const horario = await this.horarioRepository.findOne({
      where: { idHorario: id },
    });
    if (!horario) {
      throw new HttpException(
        'Horario académico no encontrado',
        HttpStatus.NOT_FOUND,
      );
    }
    return horario;
  }

  async update(
    id: number,
    updateHorarioAcademicoDto: UpdateHorarioAcademicoDto,
  ): Promise<HorarioAcademico> {
    const actual = await this.findOne(id);

    const horaInicio =
      updateHorarioAcademicoDto.horaInicio ?? actual.horaInicio;
    const horaFin = updateHorarioAcademicoDto.horaFin ?? actual.horaFin;
    if (
      updateHorarioAcademicoDto.horaInicio ||
      updateHorarioAcademicoDto.horaFin
    ) {
      this.validarRangoHoras(horaInicio, horaFin);
    }

    if (updateHorarioAcademicoDto.idLaboratorio) {
      await this.validarLaboratorio(updateHorarioAcademicoDto.idLaboratorio);
    }
    if (updateHorarioAcademicoDto.idEspacio) {
      await this.validarEspacio(updateHorarioAcademicoDto.idEspacio);
    }
    if (updateHorarioAcademicoDto.idPeriodo) {
      await this.validarPeriodo(updateHorarioAcademicoDto.idPeriodo);
    }
    if (updateHorarioAcademicoDto.idDocente) {
      await this.validarDocente(updateHorarioAcademicoDto.idDocente);
    }

    if (updateHorarioAcademicoDto.idLaboratorio || updateHorarioAcademicoDto.idEspacio) {
      await this.asegurarAsociacionEspacioLaboratorio(
        updateHorarioAcademicoDto.idLaboratorio ?? actual.idLaboratorio,
        updateHorarioAcademicoDto.idEspacio ?? actual.idEspacio,
      );
    }

    try {
      const horario = await this.horarioRepository.preload({
        idHorario: id,
        ...updateHorarioAcademicoDto,
      });
      return await this.horarioRepository.save(horario!);
    } catch {
      throw new HttpException(
        'Error al actualizar el horario académico',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
