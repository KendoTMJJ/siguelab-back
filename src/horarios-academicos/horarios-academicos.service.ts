import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';
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
  incluirInactivos?: boolean;
  buscar?: string;
}

@Injectable()
export class HorariosAcademicosService {
  private readonly horarioRepository: Repository<HorarioAcademico>;
  private readonly laboratorioRepository: Repository<Laboratorio>;
  private readonly espacioAcademicoRepository: Repository<EspacioAcademico>;
  private readonly periodoAcademicoRepository: Repository<PeriodoAcademico>;
  private readonly usuarioRepository: Repository<Usuario>;

  constructor(private readonly dataSource: DataSource) {
    this.horarioRepository = this.dataSource.getRepository(HorarioAcademico);
    this.laboratorioRepository = this.dataSource.getRepository(Laboratorio);
    this.espacioAcademicoRepository =
      this.dataSource.getRepository(EspacioAcademico);
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
   * Un mismo laboratorio no puede tener dos horarios vigentes que se crucen
   * el mismo día de la semana mientras sus periodos académicos coincidan en
   * fechas — evita duplicados (ej. al reimportar el mismo Excel) y choques
   * reales de agenda.
   */
  private async validarSinCruce(
    idLaboratorio: number,
    diaSemana: DiaSemana,
    idPeriodo: number,
    horaInicio: string,
    horaFin: string,
    idExcluir?: number,
  ): Promise<void> {
    const periodo = await this.periodoAcademicoRepository.findOne({
      where: { idPeriodo },
    });
    if (!periodo) {
      return;
    }

    const qb = this.horarioRepository
      .createQueryBuilder('horario')
      .innerJoin(
        'periodo_academico',
        'periodo',
        'periodo.id_periodo = horario.id_periodo',
      )
      .where('horario.id_laboratorio = :idLaboratorio', { idLaboratorio })
      .andWhere('horario.dia_semana = :diaSemana', { diaSemana })
      .andWhere('horario.estado = :estado', { estado: EstadoHorario.VIGENTE })
      .andWhere('horario.hora_inicio < :horaFin', { horaFin })
      .andWhere('horario.hora_fin > :horaInicio', { horaInicio })
      .andWhere('periodo.fecha_inicio <= :periodoFin', {
        periodoFin: periodo.fechaFin,
      })
      .andWhere('periodo.fecha_fin >= :periodoInicio', {
        periodoInicio: periodo.fechaInicio,
      });

    if (idExcluir) {
      qb.andWhere('horario.id_horario != :idExcluir', { idExcluir });
    }

    const conflicto = await qb.getOne();
    if (conflicto) {
      throw new HttpException(
        `Ya existe un horario en ese laboratorio los ${diaSemana} de ${conflicto.horaInicio} a ${conflicto.horaFin} que se cruza con este intervalo`,
        HttpStatus.BAD_REQUEST,
      );
    }
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
    await this.validarSinCruce(
      createHorarioAcademicoDto.idLaboratorio,
      createHorarioAcademicoDto.diaSemana,
      createHorarioAcademicoDto.idPeriodo,
      createHorarioAcademicoDto.horaInicio,
      createHorarioAcademicoDto.horaFin,
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
    const base: FindOptionsWhere<HorarioAcademico> = {
      ...(!filtros.incluirInactivos && { estado: EstadoHorario.VIGENTE }),
      ...(filtros.idLaboratorio && { idLaboratorio: filtros.idLaboratorio }),
      ...(filtros.idPeriodo && { idPeriodo: filtros.idPeriodo }),
      ...(filtros.diaSemana && { diaSemana: filtros.diaSemana }),
    };

    // Busca por espacio académico, laboratorio o grupo/asignatura (mismos
    // campos que antes se filtraban en memoria en el frontend).
    const where: FindOptionsWhere<HorarioAcademico> | FindOptionsWhere<HorarioAcademico>[] =
      filtros.buscar
        ? [
            { ...base, espacioAcademico: { nombre: ILike(`%${filtros.buscar}%`) } },
            { ...base, laboratorio: { nombre: ILike(`%${filtros.buscar}%`) } },
            { ...base, grupoAsignatura: ILike(`%${filtros.buscar}%`) },
          ]
        : base;

    return this.horarioRepository.find({
      where,
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

    const estadoResultante = updateHorarioAcademicoDto.estado ?? actual.estado;
    if (estadoResultante === EstadoHorario.VIGENTE) {
      await this.validarSinCruce(
        updateHorarioAcademicoDto.idLaboratorio ?? actual.idLaboratorio,
        updateHorarioAcademicoDto.diaSemana ?? actual.diaSemana,
        updateHorarioAcademicoDto.idPeriodo ?? actual.idPeriodo,
        horaInicio,
        horaFin,
        id,
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
