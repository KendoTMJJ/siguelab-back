import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Rol } from './entities/rol.entity';

@Injectable()
export class RolesService {
  private readonly rolRepository: Repository<Rol>;

  constructor(private readonly dataSource: DataSource) {
    this.rolRepository = this.dataSource.getRepository(Rol);
  }

  async create(createRoleDto: CreateRoleDto): Promise<Rol> {
    const existente = await this.rolRepository.findOne({
      where: { nombre: createRoleDto.nombre },
    });

    if (existente) {
      throw new HttpException('El rol ya existe', HttpStatus.CONFLICT);
    }

    try {
      const rol = this.rolRepository.create(createRoleDto);
      return await this.rolRepository.save(rol);
    } catch {
      throw new HttpException('Error al crear el rol', HttpStatus.BAD_REQUEST);
    }
  }

  findAll(): Promise<Rol[]> {
    return this.rolRepository.find();
  }

  async findOne(id: string): Promise<Rol> {
    const rol = await this.rolRepository.findOne({ where: { idRol: id } });
    if (!rol) {
      throw new HttpException('Rol no encontrado', HttpStatus.NOT_FOUND);
    }
    return rol;
  }

  async update(id: string, updateRoleDto: UpdateRoleDto): Promise<Rol> {
    await this.findOne(id);

    try {
      const rol = await this.rolRepository.preload({
        idRol: id,
        ...updateRoleDto,
      });
      return await this.rolRepository.save(rol!);
    } catch {
      throw new HttpException(
        'Error al actualizar el rol',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    try {
      await this.rolRepository.delete(id);
    } catch {
      throw new HttpException(
        'No se puede eliminar el rol porque tiene usuarios asociados',
        HttpStatus.CONFLICT,
      );
    }
  }
}
