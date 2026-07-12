import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { TokenAuth, TipoToken } from './entities/token-auth.entity';
import { Usuario } from 'src/usuarios/entities/usuario.entity';

@Injectable()
export class TokenAuthService {
  private readonly tokenRepository: Repository<TokenAuth>;

  constructor(private readonly dataSource: DataSource) {
    this.tokenRepository = this.dataSource.getRepository(TokenAuth);
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async generar(
    usuario: Usuario,
    tipo: TipoToken,
    minutosExpiracion: number,
  ): Promise<string> {
    await this.tokenRepository.update(
      { usuario: { idUsuario: usuario.idUsuario }, tipo, usado: false },
      { usado: true },
    );

    const tokenPlano = randomBytes(32).toString('hex');

    const token = this.tokenRepository.create({
      usuario,
      tipo,
      tokenHash: this.hash(tokenPlano),
      expiraEn: new Date(Date.now() + minutosExpiracion * 60 * 1000),
      usado: false,
    });

    await this.tokenRepository.save(token);
    return tokenPlano;
  }

  async consumir(
    tokenPlano: string,
    tipo: TipoToken,
  ): Promise<TokenAuth | null> {
    const token = await this.tokenRepository.findOne({
      where: { tokenHash: this.hash(tokenPlano), tipo, usado: false },
      relations: { usuario: true },
    });

    if (!token || token.expiraEn < new Date()) {
      return null;
    }

    token.usado = true;
    await this.tokenRepository.save(token);
    return token;
  }
}
