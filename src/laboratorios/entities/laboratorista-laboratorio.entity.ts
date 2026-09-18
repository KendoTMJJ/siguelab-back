import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Laboratorio } from './laboratorio.entity';

/**
 * Unión explícita (mismo patrón que DocenteLaboratorio): define qué
 * laboratoristas pueden ver/gestionar las solicitudes de cada laboratorio
 * (serán la firma de orden 2) — un laboratorista sin ninguna fila acá no
 * puede aprobar/rechazar/crear reservas directas para ningún laboratorio
 * (ver SolicitudesService: firmar/rechazar/findPendientesDeMiFirma/
 * crearDirecta/crearDirectaLote). Es many-to-many porque un mismo
 * laboratorista puede estar a cargo de varios laboratorios (confirmado con
 * el documento real de la universidad: 8 de 10 laboratoristas cubren más de
 * uno).
 */
@Entity('laboratorista_laboratorio')
export class LaboratoristaLaboratorio {
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
