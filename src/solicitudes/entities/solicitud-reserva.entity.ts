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

  /** Null SOLO para el tipo "Evento especial" (esExclusiva, creado por
   * admin/laboratorista vía crearDirectaLote) — no tiene un docente
   * académico asociado. Para cualquier otra reserva sigue siendo
   * obligatorio: create()/crearDirecta() lo exigen en su DTO
   * (@IsUUID() sin @IsOptional()), así que ningún otro camino de creación
   * puede dejarlo en null. Todo lector debe tratarlo como opcional
   * (`docenteEncargado?.nombre ?? '—'`, mismo criterio que ya usa
   * historial.ts). */
  @Column({ name: 'id_docente_encargado', type: 'uuid', nullable: true })
  idDocenteEncargado!: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'id_docente_encargado' })
  docenteEncargado?: Usuario | null;

  /** Laboratorista elegido al crear la solicitud (mismo criterio que
   * idDocenteEncargado: obligatorio en create(), ver CreateSolicitudDto).
   * Nullable por dos motivos — evento especial (nunca lo tiene, igual que
   * idDocenteEncargado) y solicitudes creadas ANTES de este campo (filas
   * legacy): SolicitudesService.firmar/rechazar/findPendientesDeMiFirma
   * caen de vuelta al criterio anterior (cualquier laboratorista asociado
   * al laboratorio) solo cuando esto es null, para no dejar huérfanas las
   * solicitudes pendientes que ya existían. */
  @Column({ name: 'id_laboratorista_encargado', type: 'uuid', nullable: true })
  idLaboratoristaEncargado!: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'id_laboratorista_encargado' })
  laboratoristaEncargado?: Usuario | null;

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

  /** Obligatorio para cualquier tipo de reserva (formato EATUF) — nullable
   * en BD solo por datos históricos previos a esa exigencia. */
  @Column({ name: 'id_espacio', nullable: true })
  idEspacio?: number | null;

  @ManyToOne(() => EspacioAcademico, { nullable: true })
  @JoinColumn({ name: 'id_espacio' })
  espacioAcademico?: EspacioAcademico | null;

  /** Trazabilidad pura: la carrera que el solicitante declara. No filtra ni
   * valida nada más. Null solo para "Evento especial" — ver comentario de
   * idDocenteEncargado, mismo criterio. */
  @Column({ name: 'id_facultad', nullable: true })
  idFacultad!: number | null;

  @ManyToOne(() => Facultad, { nullable: true })
  @JoinColumn({ name: 'id_facultad' })
  facultad?: Facultad | null;

  /** Null solo para "Evento especial" — ver comentario de idDocenteEncargado,
   * mismo criterio. Sin periodo no aplica el chequeo de "fecha dentro del
   * periodo" ni el cálculo de semana académica (ver crearDirectaLote). */
  @Column({ name: 'id_periodo', nullable: true })
  idPeriodo!: number | null;

  @ManyToOne(() => PeriodoAcademico, { nullable: true })
  @JoinColumn({ name: 'id_periodo' })
  periodoAcademico?: PeriodoAcademico | null;

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

  @Column({ default: false })
  archivada!: boolean;

  @Column({ default: false })
  eliminada!: boolean;

  @Column({ name: 'reactivos_sustancias', type: 'text', nullable: true })
  reactivosSustancias?: string | null;

  @Column({ name: 'equipos_insumos', type: 'text', nullable: true })
  equiposInsumos?: string | null;

  @Column({ name: 'materiales_estudiante', type: 'text', nullable: true })
  materialesEstudiante?: string | null;

  @Column({ name: 'id_lote_especial', type: 'uuid', nullable: true })
  idLoteEspecial?: string | null;

  /** Solo lo llena crearDirectaLote (reserva especial): nombre de quien
   * organiza/responde por el evento, texto libre — quien arma una reserva
   * especial normalmente no es un docente asociado al laboratorio, así que
   * no alcanza con idDocenteEncargado para saber a quién contactar. Null
   * para cualquier otra reserva. */
  @Column({ name: 'responsable', type: 'varchar', length: 200, nullable: true })
  responsable?: string | null;

  @OneToMany(() => Firma, (firma) => firma.solicitud)
  firmas!: Firma[];

  @OneToMany(() => SolicitudEvento, (evento) => evento.solicitud)
  eventos!: SolicitudEvento[];

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;
}
