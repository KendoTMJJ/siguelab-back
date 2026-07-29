import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';
import { EspacioLaboratorio } from 'src/laboratorios/entities/espacio-laboratorio.entity';
import { DocenteLaboratorio } from 'src/laboratorios/entities/docente-laboratorio.entity';
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
  buscar?: string;
}

@Injectable()
export class HorariosAcademicosService {
  private readonly horarioRepository: Repository<HorarioAcademico>;
  private readonly laboratorioRepository: Repository<Laboratorio>;
  private readonly espacioAcademicoRepository: Repository<EspacioAcademico>;
  private readonly espacioLaboratorioRepository: Repository<EspacioLaboratorio>;
  private readonly docenteLaboratorioRepository: Repository<DocenteLaboratorio>;
  private readonly periodoAcademicoRepository: Repository<PeriodoAcademico>;
  private readonly usuarioRepository: Repository<Usuario>;

  constructor(private readonly dataSource: DataSource) {
    this.horarioRepository = this.dataSource.getRepository(HorarioAcademico);
    this.laboratorioRepository = this.dataSource.getRepository(Laboratorio);
    this.espacioAcademicoRepository =
      this.dataSource.getRepository(EspacioAcademico);
    this.espacioLaboratorioRepository =
      this.dataSource.getRepository(EspacioLaboratorio);
    this.docenteLaboratorioRepository =
      this.dataSource.getRepository(DocenteLaboratorio);
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

  /**
   * Mismo motivo que asegurarAsociacionEspacioLaboratorio: SolicitudesService
   * exige (id_docente_encargado, id_laboratorio) en docente_laboratorio (CTX-5)
   * para que ese docente sea seleccionable como encargado. Sin esto, el
   * docente de un horario académico recién creado no aparece en
   * "docentes encargados" del laboratorio hasta que el admin lo asocia a mano.
   */
  private async asegurarAsociacionDocenteLaboratorio(
    idLaboratorio: number,
    idUsuario: string,
  ): Promise<void> {
    const existente = await this.docenteLaboratorioRepository.exists({
      where: { idLaboratorio, idUsuario },
    });
    if (existente) {
      return;
    }
    const asociacion = this.docenteLaboratorioRepository.create({
      idLaboratorio,
      idUsuario,
    });
    await this.docenteLaboratorioRepository.save(asociacion);
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
    if (createHorarioAcademicoDto.idDocente) {
      await this.asegurarAsociacionDocenteLaboratorio(
        createHorarioAcademicoDto.idLaboratorio,
        createHorarioAcademicoDto.idDocente,
      );
    }

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
    const query = this.horarioRepository
      .createQueryBuilder('horario')
      .leftJoinAndSelect('horario.laboratorio', 'laboratorio')
      .leftJoinAndSelect('horario.espacioAcademico', 'espacioAcademico')
      .where('horario.estado = :estado', { estado: EstadoHorario.VIGENTE });

    if (filtros.idLaboratorio) {
      query.andWhere('horario.id_laboratorio = :idLaboratorio', {
        idLaboratorio: filtros.idLaboratorio,
      });
    }
    if (filtros.idPeriodo) {
      query.andWhere('horario.id_periodo = :idPeriodo', {
        idPeriodo: filtros.idPeriodo,
      });
    }
    if (filtros.diaSemana) {
      query.andWhere('horario.dia_semana = :diaSemana', {
        diaSemana: filtros.diaSemana,
      });
    }
    if (filtros.buscar) {
      query.andWhere(
        '(espacioAcademico.nombre LIKE :buscar OR laboratorio.nombre LIKE :buscar ' +
          'OR horario.grupo_asignatura LIKE :buscar OR horario.codigo LIKE :buscar)',
        { buscar: `%${filtros.buscar}%` },
      );
    }

    return query
      .orderBy('horario.dia_semana', 'ASC')
      .addOrderBy('horario.hora_inicio', 'ASC')
      .getMany();
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

    if (
      updateHorarioAcademicoDto.idLaboratorio ||
      updateHorarioAcademicoDto.idEspacio
    ) {
      await this.asegurarAsociacionEspacioLaboratorio(
        updateHorarioAcademicoDto.idLaboratorio ?? actual.idLaboratorio,
        updateHorarioAcademicoDto.idEspacio ?? actual.idEspacio,
      );
    }
    const idDocenteResultante =
      updateHorarioAcademicoDto.idDocente ?? actual.idDocente;
    if (
      idDocenteResultante &&
      (updateHorarioAcademicoDto.idLaboratorio ||
        updateHorarioAcademicoDto.idDocente)
    ) {
      await this.asegurarAsociacionDocenteLaboratorio(
        updateHorarioAcademicoDto.idLaboratorio ?? actual.idLaboratorio,
        idDocenteResultante,
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
