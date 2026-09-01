import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { Laboratorio } from './laboratorio.entity';

/**
 * Unión explícita (mismo patrón que DocenteLaboratorio): registra qué
 * laboratorista/analista está a cargo de cada laboratorio, para tener la
 * misma trazabilidad que el documento de referencia de la universidad
 * (Relación de Laboratorios, Espacios Académicos y Laboratoristas). Es
 * puramente informativo — a propósito NO restringe qué laboratorios puede
 * ver/gestionar un laboratorista (eso sigue igual que antes); es
 * many-to-many porque un mismo laboratorista puede estar a cargo de varios
 * laboratorios (confirmado con el documento real: 8 de 10 laboratoristas
 * cubren más de uno).
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
