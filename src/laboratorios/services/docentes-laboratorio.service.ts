import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EstadoUsuario, Usuario } from 'src/usuarios/entities/usuario.entity';
import { DocenteLaboratorio } from '../entities/docente-laboratorio.entity';
import { LaboratoriosService } from './laboratorios.service';

export interface DocenteEncargado {
  idUsuario: string;
  nombre: string;
  correo: string;
}

@Injectable()
export class DocentesLaboratorioService {
  private readonly docenteLaboratorioRepository: Repository<DocenteLaboratorio>;
  private readonly usuarioRepository: Repository<Usuario>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly laboratoriosService: LaboratoriosService,
  ) {
    this.docenteLaboratorioRepository =
      this.dataSource.getRepository(DocenteLaboratorio);
    this.usuarioRepository = this.dataSource.getRepository(Usuario);
  }

  private async validarUsuarioDocente(idUsuario: string): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({
      where: { idUsuario },
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
    return usuario;
  }

  /** Lo consume el formulario: solo id, nombre y correo, nunca la contraseña. */
  async docentesDeLaboratorio(
    idLaboratorio: number,
  ): Promise<DocenteEncargado[]> {
    await this.laboratoriosService.findOne(idLaboratorio);

    const asociaciones = await this.docenteLaboratorioRepository.find({
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
  ): Promise<DocenteLaboratorio> {
    await this.laboratoriosService.validarDisponibleParaAsociar(idLaboratorio);
    await this.validarUsuarioDocente(idUsuario);

    const existente = await this.docenteLaboratorioRepository.findOne({
      where: { idLaboratorio, idUsuario },
    });
    if (existente) {
      throw new HttpException(
        'El docente ya está asociado a este laboratorio',
        HttpStatus.CONFLICT,
      );
    }

    const asociacion = this.docenteLaboratorioRepository.create({
      idLaboratorio,
      idUsuario,
    });
    return this.docenteLaboratorioRepository.save(asociacion);
  }

  async desasociar(idLaboratorio: number, idUsuario: string): Promise<void> {
    const existente = await this.docenteLaboratorioRepository.findOne({
      where: { idLaboratorio, idUsuario },
    });
    if (!existente) {
      throw new HttpException(
        'El docente no está asociado a este laboratorio',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.docenteLaboratorioRepository.remove(existente);
  }

  /** Uso interno del módulo de solicitudes (CTX-5): valida el par sin exponer HTTP. */
  async estaAsociado(
    idLaboratorio: number,
    idUsuario: string,
  ): Promise<boolean> {
    return this.docenteLaboratorioRepository.exists({
      where: { idLaboratorio, idUsuario },
    });
  }
}
