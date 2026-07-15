import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { EstadoUsuario, Usuario } from 'src/usuarios/entities/usuario.entity';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usuariosService: UsuariosService) {
    super({
      jwtFromRequest: (req: Request): string | null => {
        const cookies = req?.cookies as Record<string, string> | undefined;
        return cookies?.['access_token'] ?? null;
      },
      ignoreExpiration: false,
      secretOrKey: String(process.env.JWT_SECRET),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub || !payload?.correo) {
      throw new UnauthorizedException('Token inválido');
    }

    let usuario: Usuario;
    try {
      usuario = await this.usuariosService.findOne(payload.sub);
    } catch {
      throw new UnauthorizedException('Acceso no autorizado');
    }

    if (usuario.estado !== EstadoUsuario.ACTIVO) {
      throw new UnauthorizedException('Acceso no autorizado');
    }

    if (payload.tokenVersion !== usuario.tokenVersion) {
      throw new UnauthorizedException(
        'Sesión inválida, vuelve a iniciar sesión',
      );
    }

    return {
      id: usuario.idUsuario,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol.nombre,
    };
  }
}
