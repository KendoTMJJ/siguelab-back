import { Usuario } from 'src/usuarios/entities/usuario.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum TipoToken {
  VERIFICACION = 'verificacion',
  RESET_PASSWORD = 'reset_password',
}

@Entity('token_auth')
export class TokenAuth {
  @PrimaryGeneratedColumn('uuid', { name: 'id_token' })
  idToken!: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario!: Usuario;

  @Column({ type: 'enum', enum: TipoToken })
  tipo!: TipoToken;

  @Column({ name: 'token_hash', length: 255 })
  tokenHash!: string;

  @Column({ name: 'expira_en', type: 'timestamp' })
  expiraEn!: Date;

  @Column({ default: false })
  usado!: boolean;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion!: Date;
}
