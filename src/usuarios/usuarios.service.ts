import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Rol } from 'src/roles/entities/rol.entity';
import { Usuario } from './entities/usuario.entity';
import {
  PaginatedResult,
  buildPaginatedResult,
} from 'src/common/pagination/paginated-result.interface';
import { PaginationParams } from 'src/common/pagination/pagination.util';

const ROL_POR_DEFECTO = 'estudiante';

@Injectable()
export class UsuariosService {
  private readonly usuarioRepository: Repository<Usuario>;
  private readonly rolRepository: Repository<Rol>;

  constructor(private readonly dataSource: DataSource) {
    this.usuarioRepository = this.dataSource.getRepository(Usuario);
    this.rolRepository = this.dataSource.getRepository(Rol);
  }

  /**
   * Único punto de entrada de identidad: lo llama la estrategia de Entra en
   * cada request. Busca primero por `oid` (ya vinculado en un login previo);
   * si no existe, busca por correo (un admin puede haber pre-creado la fila
   * para asignarle un rol de entrada) y enlaza el oid; si tampoco existe,
   * crea el usuario con el rol por defecto.
   */
  async findOrCreateByOid(perfil: {
    oid: string;
    correo: string;
    nombre: string;
  }): Promise<Usuario> {
    const porOid = await this.usuarioRepository.findOne({
      where: { oid: perfil.oid },
      relations: { rol: true },
    });
    if (porOid) {
      return porOid;
    }

    const porCorreo = await this.usuarioRepository.findOne({
      where: { correo: perfil.correo },
      relations: { rol: true },
    });
    if (porCorreo) {
      porCorreo.oid = perfil.oid;
      return this.usuarioRepository.save(porCorreo);
    }

    const rolPorDefecto = await this.rolRepository.findOne({
      where: { nombre: ROL_POR_DEFECTO },
    });
    if (!rolPorDefecto) {
      throw new HttpException(
        'No se pudo asignar el rol por defecto',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const usuario = this.usuarioRepository.create({
      oid: perfil.oid,
      correo: perfil.correo,
      nombre: perfil.nombre,
      rol: rolPorDefecto,
    });

    return this.usuarioRepository.save(usuario);
  }

  /**
   * Único punto de escritura de cargo/facultad — lo llama DirectorioService
   * tras recibir esos datos del frontend (que los trajo de Microsoft Graph).
   * Este servicio sigue siendo el único dueño del repositorio de Usuario.
   */
  async actualizarInfoDirectorio(
    id: string,
    datos: { cargo?: string; facultad?: string },
  ): Promise<Usuario> {
    const usuario = await this.findOne(id);
    if (datos.cargo !== undefined) usuario.cargo = datos.cargo;
    if (datos.facultad !== undefined) usuario.facultad = datos.facultad;
    return this.usuarioRepository.save(usuario);
  }

  async create(createUsuarioDto: CreateUsuarioDto): Promise<Usuario> {
    try {
      const existente = await this.usuarioRepository.findOne({
        where: { correo: createUsuarioDto.correo },
      });

      if (existente) {
        throw new HttpException(
          'El correo ya está registrado',
          HttpStatus.CONFLICT,
        );
      }

      const { idRol, ...rest } = createUsuarioDto;
      const usuario = this.usuarioRepository.create({
        ...rest,
        rol: { idRol } as Usuario['rol'],
      });

      return await this.usuarioRepository.save(usuario);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Error al crear el usuario',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Único punto de entrada para listar usuarios — paginado siempre (ver
   * PaginationParams: nunca "sin límite"). `buscar` reemplaza al antiguo
   * GET /usuarios/nombre/:nombreUsuario, que traía la coincidencia completa
   * sin paginar; ahora es el mismo filtro combinado con la paginación.
   */
  async findAll(
    pagination: PaginationParams,
    buscar?: string,
    rol?: string,
    estado?: string,
  ): Promise<PaginatedResult<Usuario>> {
    const query = this.usuarioRepository
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .orderBy('usuario.nombre', 'ASC');

    if (buscar) {
      query.andWhere('LOWER(usuario.nombre) LIKE LOWER(:buscar)', {
        buscar: `%${buscar}%`,
      });
    }
    if (rol) {
      query.andWhere('rol.nombre = :rol', { rol });
    }
    if (estado) {
      query.andWhere('usuario.estado = :estado', { estado });
    }

    const [data, total] = await query
      .skip(pagination.skip)
      .take(pagination.take)
      .getManyAndCount();

    return buildPaginatedResult(data, total, pagination.page, pagination.limit);
  }

  async findOne(id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({
      where: { idUsuario: id },
      relations: { rol: true },
    });
    if (!usuario) {
      throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
    }
    return usuario;
  }

  async update(
    id: string,
    updateUsuarioDto: UpdateUsuarioDto,
  ): Promise<Usuario> {
    try {
      const usuario = await this.findOne(id);
      const { idRol, ...rest } = updateUsuarioDto;

      Object.assign(usuario, rest);
      if (idRol !== undefined) usuario.rol = { idRol } as Usuario['rol'];

      return await this.usuarioRepository.save(usuario);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Error al actualizar el usuario',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: string): Promise<void> {
    const usuario = await this.findOne(id);
    await this.usuarioRepository.softRemove(usuario);
  }
}
