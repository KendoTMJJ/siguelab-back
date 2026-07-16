import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Laboratorio } from './laboratorio.entity';

/**
 * Unión explícita: define qué docentes son seleccionables como "docente
 * encargado" al elegir un laboratorio (serán la firma de orden 1 de las
 * solicitudes de estudiantes).
 */
@Entity('docente_laboratorio')
export class DocenteLaboratorio {
  @PrimaryColumn({ name: 'id_usuario', type: 'uuid' })
  idUsuario!: string;

  @PrimaryColumn({ name: 'id_laboratorio' })
  idLaboratorio!: number;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_usuario' })
  usuario!: Usuario;

  @ManyToOne(() => Laboratorio)
  @JoinColumn({ name: 'id_laboratorio' })
  laboratorio!: Laboratorio;
}
