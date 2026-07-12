import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('rol')
export class Rol {
  @PrimaryGeneratedColumn({ name: 'id_rol' })
  idRol!: number;

  @Column({ length: 30, unique: true })
  nombre!: string;
}
