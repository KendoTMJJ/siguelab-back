import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { EspacioAcademico } from 'src/catalogos/entities/espacio-academico.entity';
import { Laboratorio } from './laboratorio.entity';

/**
 * Unión explícita (no @ManyToMany implícito): es el único filtro de
 * laboratorios del sistema — al elegir una materia, el formulario ofrece
 * solo sus laboratorios asociados aquí.
 */
@Entity('espacio_laboratorio')
export class EspacioLaboratorio {
  @PrimaryColumn({ name: 'id_espacio' })
  idEspacio!: number;

  @PrimaryColumn({ name: 'id_laboratorio' })
  idLaboratorio!: number;

  @ManyToOne(() => EspacioAcademico)
  @JoinColumn({ name: 'id_espacio' })
  espacioAcademico!: EspacioAcademico;

  @ManyToOne(() => Laboratorio)
  @JoinColumn({ name: 'id_laboratorio' })
  laboratorio!: Laboratorio;
}
