import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('rol')
export class Rol {
  @PrimaryGeneratedColumn('uuid', { name: 'id_rol' })
  idRol!: string;

  @Column({ length: 30, unique: true })
  nombre!: string;
}
