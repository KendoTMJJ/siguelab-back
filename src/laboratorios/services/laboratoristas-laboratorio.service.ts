import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EstadoUsuario, Usuario } from 'src/usuarios/entities/usuario.entity';
import { LaboratoristaLaboratorio } from '../entities/laboratorista-laboratorio.entity';
import { LaboratoriosService } from './laboratorios.service';

export interface LaboratoristaEncargado {
  idUsuario: string;
  nombre: string;
  correo: string;
}

/** Mismo criterio que DocentesLaboratorioService — puramente informativo
 * (trazabilidad de "quién es el responsable de cada laboratorio"), no
 * restringe qué laboratorios puede ver/gestionar el laboratorista. */
@Injectable()
export class LaboratoristasLaboratorioService {
  private readonly laboratoristaLaboratorioRepository: Repository<LaboratoristaLaboratorio>;
  private readonly usuarioRepository: Repository<Usuario>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly laboratoriosService: LaboratoriosService,
  ) {
    this.laboratoristaLaboratorioRepository = this.dataSource.getRepository(
      LaboratoristaLaboratorio,
    );
    this.usuarioRepository = this.dataSource.getRepository(Usuario);
  }

  private async validarUsuarioLaboratorista(
    idUsuario: string,
  ): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({
      where: { idUsuario },
      relations: { rol: true },
    });
    if (!usuario) {
      throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
    }
    if (usuario.rol.nombre !== 'laboratorista') {
      throw new HttpException(
        'El usuario debe tener rol laboratorista',
        HttpStatus.BAD_REQUEST,
      );
    }
    return usuario;
  }

  /** Lo consume el formulario de administración: solo id, nombre y correo,
   * nunca la contraseña — mismo criterio que docentesDeLaboratorio. */
  async laboratoristasDeLaboratorio(
    idLaboratorio: number,
  ): Promise<LaboratoristaEncargado[]> {
    await this.laboratoriosService.findOne(idLaboratorio);

    const asociaciones = await this.laboratoristaLaboratorioRepository.find({
      where: { idLaboratorio },
    });
    if (asociaciones.length === 0) {
      return [];
    }

    const usuarios = await this.usuarioRepository.find({
      where: asociaciones.map((a) => ({
        idUsuario: a.idUsuario,
        estado: EstadoUsuario.ACTIVO,
      })),
      order: { nombre: 'ASC' },
    });

    return usuarios.map((u) => ({
      idUsuario: u.idUsuario,
      nombre: u.nombre,
      correo: u.correo,
    }));
  }

  async asociar(
    idLaboratorio: number,
    idUsuario: string,
  ): Promise<LaboratoristaLaboratorio> {
    await this.laboratoriosService.validarDisponibleParaAsociar(idLaboratorio);
    await this.validarUsuarioLaboratorista(idUsuario);

    const existente = await this.laboratoristaLaboratorioRepository.findOne({
      where: { idLaboratorio, idUsuario },
    });
    if (existente) {
      throw new HttpException(
        'El laboratorista ya está asociado a este laboratorio',
        HttpStatus.CONFLICT,
      );
    }

    const asociacion = this.laboratoristaLaboratorioRepository.create({
      idLaboratorio,
      idUsuario,
    });
    return this.laboratoristaLaboratorioRepository.save(asociacion);
  }

  async desasociar(idLaboratorio: number, idUsuario: string): Promise<void> {
    const existente = await this.laboratoristaLaboratorioRepository.findOne({
      where: { idLaboratorio, idUsuario },
    });
    if (!existente) {
      throw new HttpException(
        'El laboratorista no está asociado a este laboratorio',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.laboratoristaLaboratorioRepository.remove(existente);
  }
}
