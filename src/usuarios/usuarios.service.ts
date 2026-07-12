import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Usuario } from './entities/usuario.entity';
import { Rol } from 'src/roles/entities/rol.entity';

const ROL_REGISTRO_PUBLICO = 'estudiante';

@Injectable()
export class UsuariosService {
  private readonly usuarioRepository: Repository<Usuario>;
  private readonly rolRepository: Repository<Rol>;

  constructor(private readonly dataSource: DataSource) {
    this.usuarioRepository = this.dataSource.getRepository(Usuario);
    this.rolRepository = this.dataSource.getRepository(Rol);
  }

  async registrarPublico(datos: {
    nombre: string;
    correo: string;
    contrasena: string;
  }): Promise<Usuario> {
    const existente = await this.usuarioRepository.findOne({
      where: { correo: datos.correo },
    });

    if (existente) {
      throw new HttpException(
        'El correo ya está registrado',
        HttpStatus.CONFLICT,
      );
    }

    const rolEstudiante = await this.rolRepository.findOne({
      where: { nombre: ROL_REGISTRO_PUBLICO },
    });

    if (!rolEstudiante) {
      throw new HttpException(
        'No se pudo asignar el rol por defecto',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const usuario = this.usuarioRepository.create({
      nombre: datos.nombre,
      correo: datos.correo,
      contrasena: await bcrypt.hash(datos.contrasena, 10),
      rol: rolEstudiante,
      correoVerificado: false,
    });

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

      const { idRol, contrasena, ...rest } = createUsuarioDto;
      const usuario = this.usuarioRepository.create({
        ...rest,
        contrasena: await bcrypt.hash(contrasena, 10),
        rol: { idRol },
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

  async findAll(): Promise<Usuario[]> {
    return this.usuarioRepository.find({ relations: { rol: true } });
  }

  async findOne(id: number): Promise<Usuario> {
    const usuario = await this.usuarioRepository.findOne({
      where: { idUsuario: id },
      relations: { rol: true },
    });
    if (!usuario) {
      throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
    }
    return usuario;
  }

  async findByCorreo(correo: string): Promise<Usuario | null> {
    return this.usuarioRepository
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .addSelect('usuario.contrasena')
      .where('usuario.correo = :correo', { correo })
      .getOne();
  }

  async update(
    id: number,
    updateUsuarioDto: UpdateUsuarioDto,
  ): Promise<Usuario> {
    try {
      const usuario = await this.findOne(id);
      const { idRol, contrasena, ...rest } = updateUsuarioDto;

      Object.assign(usuario, rest);
      if (idRol !== undefined) usuario.rol = { idRol } as Usuario['rol'];
      if (contrasena !== undefined) {
        usuario.contrasena = await bcrypt.hash(contrasena, 10);
      }

      return await this.usuarioRepository.save(usuario);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Error al actualizar el usuario',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: number): Promise<void> {
    const usuario = await this.findOne(id);
    await this.usuarioRepository.softRemove(usuario);
  }

  async marcarCorreoVerificado(id: number): Promise<void> {
    await this.usuarioRepository.update(id, { correoVerificado: true });
  }

  async registrarLoginExitoso(id: number): Promise<void> {
    await this.usuarioRepository.update(id, {
      intentosFallidos: 0,
      bloqueadoHasta: null,
    });
  }

  async registrarIntentoFallido(usuario: Usuario): Promise<void> {
    const intentos = usuario.intentosFallidos + 1;
    const MAX_INTENTOS = 5;
    const MINUTOS_BLOQUEO = 15;

    await this.usuarioRepository.update(usuario.idUsuario, {
      intentosFallidos: intentos,
      bloqueadoHasta:
        intentos >= MAX_INTENTOS
          ? new Date(Date.now() + MINUTOS_BLOQUEO * 60 * 1000)
          : usuario.bloqueadoHasta,
    });
  }

  async cambiarContrasena(id: number, contrasena: string): Promise<void> {
    await this.usuarioRepository
      .createQueryBuilder()
      .update(Usuario)
      .set({
        contrasena: await bcrypt.hash(contrasena, 10),
        tokenVersion: () => 'token_version + 1',
      })
      .where('id_usuario = :id', { id })
      .execute();
  }
}
