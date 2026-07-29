import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';
import { EspacioAcademico } from 'src/catalogos/entities/espacio-academico.entity';
import { PeriodoAcademico } from 'src/catalogos/entities/periodo-academico.entity';
import { Usuario } from 'src/usuarios/entities/usuario.entity';

export enum DiaSemana {
  LUNES = 'lunes',
  MARTES = 'martes',
  MIERCOLES = 'miercoles',
  JUEVES = 'jueves',
  VIERNES = 'viernes',
  SABADO = 'sabado',
  DOMINGO = 'domingo',
}

export enum EstadoHorario {
  VIGENTE = 'vigente',
  MODIFICADO = 'modificado',
  INACTIVO = 'inactivo',
}

/**
 * Clases ya programadas que bloquean el calendario como reservas exclusivas.
 * Sin soft delete: no es catálogo ni laboratorio, y el "borrado" es
 * estado: 'inactivo' vía PATCH (no hay DELETE, ver spec del módulo).
 */
@Entity('horario_academico')
export class HorarioAcademico {
  @PrimaryGeneratedColumn({ name: 'id_horario' })
  idHorario!: number;

  @Column({ name: 'id_laboratorio' })
  idLaboratorio!: number;

  @ManyToOne(() => Laboratorio)
  @JoinColumn({ name: 'id_laboratorio' })
  laboratorio!: Laboratorio;

  @Column({ name: 'id_espacio' })
  idEspacio!: number;

  @ManyToOne(() => EspacioAcademico)
  @JoinColumn({ name: 'id_espacio' })
  espacioAcademico!: EspacioAcademico;

  @Column({ name: 'id_docente', type: 'uuid', nullable: true })
  idDocente?: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'id_docente' })
  docente?: Usuario | null;

  @Column({ name: 'id_periodo' })
  idPeriodo!: number;

  @ManyToOne(() => PeriodoAcademico)
  @JoinColumn({ name: 'id_periodo' })
  periodoAcademico!: PeriodoAcademico;

  @Column({
    name: 'grupo_asignatura',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  grupoAsignatura?: string | null;

  /**
   * Código formal de sección/grupo (viene del Excel fuente). Distinto de
   * grupoAsignatura (etiqueta libre tipo "G1"): un mismo grupo puede tener
   * un código de sección propio. Sin unicidad, igual que grupoAsignatura.
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  codigo?: string | null;

  @Column({ name: 'dia_semana', type: 'enum', enum: DiaSemana })
  diaSemana!: DiaSemana;

  @Column({ name: 'hora_inicio', type: 'time' })
  horaInicio!: string;

  @Column({ name: 'hora_fin', type: 'time' })
  horaFin!: string;

  @Column({
    type: 'enum',
    enum: EstadoHorario,
    default: EstadoHorario.VIGENTE,
  })
  estado!: EstadoHorario;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion!: Date;
}
