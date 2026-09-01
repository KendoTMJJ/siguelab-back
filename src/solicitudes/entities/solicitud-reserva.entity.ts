import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';
import { TipoReserva } from 'src/catalogos/entities/tipo-reserva.entity';
import { EspacioAcademico } from 'src/catalogos/entities/espacio-academico.entity';
import { Facultad } from 'src/catalogos/entities/facultad.entity';
import { PeriodoAcademico } from 'src/catalogos/entities/periodo-academico.entity';
import { Firma } from './firma.entity';
import { SolicitudEvento } from './solicitud-evento.entity';

export enum EstadoSolicitud {
  PENDIENTE_DOCENTE = 'pendiente_docente',
  PENDIENTE_LABORATORISTA = 'pendiente_laboratorista',
  APROBADA = 'aprobada',
  /** Cierre real del flujo: el laboratorista ya registró el uso en bitácora
   * (ver BitacoraService.create -> SolicitudesService.marcarRealizada).
   * Antes de esto, una solicitud aprobada se quedaba "aprobada" para
   * siempre, sin ningún estado que reflejara que la práctica ya ocurrió. */
  REALIZADA = 'realizada',
  RECHAZADA = 'rechazada',
  CANCELADA = 'cancelada',
}

@Entity('solicitud_reserva')
export class SolicitudReserva {
  @PrimaryGeneratedColumn({ name: 'id_solicitud' })
  idSolicitud!: number;

  @Column({ name: 'id_solicitante', type: 'uuid' })
  idSolicitante!: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_solicitante' })
  solicitante!: Usuario;

  @Column({ name: 'id_docente_encargado', type: 'uuid' })
  idDocenteEncargado!: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'id_docente_encargado' })
  docenteEncargado!: Usuario;

  @Column({ name: 'id_laboratorio' })
  idLaboratorio!: number;

  @ManyToOne(() => Laboratorio)
  @JoinColumn({ name: 'id_laboratorio' })
  laboratorio!: Laboratorio;

  @Column({ name: 'id_tipo' })
  idTipo!: number;

  @ManyToOne(() => TipoReserva)
  @JoinColumn({ name: 'id_tipo' })
  tipoReserva!: TipoReserva;

  /** Obligatorio solo si tipoReserva.requiereEspacio = true. */
  @Column({ name: 'id_espacio', nullable: true })
  idEspacio?: number | null;

  @ManyToOne(() => EspacioAcademico, { nullable: true })
  @JoinColumn({ name: 'id_espacio' })
  espacioAcademico?: EspacioAcademico | null;

  /** Trazabilidad pura: la carrera que el solicitante declara. No filtra ni valida nada más. */
  @Column({ name: 'id_facultad' })
  idFacultad!: number;

  @ManyToOne(() => Facultad)
  @JoinColumn({ name: 'id_facultad' })
  facultad!: Facultad;

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

  @Column({ name: 'num_grupos_trabajo', type: 'int', nullable: true })
  numGruposTrabajo?: number | null;

  @Column({ name: 'fecha_practica', type: 'date' })
  fechaPractica!: string;

  @Column({ name: 'hora_inicio', type: 'time' })
  horaInicio!: string;

  @Column({ name: 'hora_fin', type: 'time' })
  horaFin!: string;

  @Column({ name: 'nombre_practica', length: 200 })
  nombrePractica!: string;

  @Column({ name: 'num_personas', type: 'int' })
  numPersonas!: number;

  @Column({ type: 'int', nullable: true })
  semana?: number | null;

  @Column({
    type: 'enum',
    enum: EstadoSolicitud,
    default: EstadoSolicitud.PENDIENTE_DOCENTE,
  })
  estado!: EstadoSolicitud;

  @Column({ name: 'motivo_cancelacion', type: 'text', nullable: true })
  motivoCancelacion?: string | null;

  /** El solicitante puede "limpiar" su vista de Mis Solicitudes ocultando
   * las suyas ya resueltas (rechazada/cancelada) — no borra el registro,
   * solo lo saca de findMias. Historial/Estadísticas/Bandeja no la miran. */
  @Column({ default: false })
  archivada!: boolean;

  /** "Vaciar archivadas" — soft delete separado de `archivada`: saca la
   * solicitud de Mis Solicitudes para siempre (activas Y archivadas), pero
   * NO toca Historial/Estadísticas (esas vistas no filtran por esta
   * columna, así que siguen viendo todo — el rastro de auditoría para
   * admin/laboratorista nunca depende de lo que el solicitante decida
   * limpiar de su propia bandeja). */
  @Column({ default: false })
  eliminada!: boolean;

  @Column({ name: 'reactivos_sustancias', type: 'text', nullable: true })
  reactivosSustancias?: string | null;

  @Column({ name: 'equipos_insumos', type: 'text', nullable: true })
  equiposInsumos?: string | null;

  @Column({ name: 'materiales_estudiante', type: 'text', nullable: true })
  materialesEstudiante?: string | null;

  @OneToMany(() => Firma, (firma) => firma.solicitud)
  firmas!: Firma[];

  @OneToMany(() => SolicitudEvento, (evento) => evento.solicitud)
  eventos!: SolicitudEvento[];

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;
}
