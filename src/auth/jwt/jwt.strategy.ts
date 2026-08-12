import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { EstadoUsuario } from 'src/usuarios/entities/usuario.entity';
import { EntraTokenPayload } from './entra-token.interface';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Entra ID es la única fuente de identidad: este backend es puramente un
 * resource server — valida el access token que el frontend (MSAL) ya
 * obtuvo directamente de Microsoft, nunca hace el login/redirect él mismo.
 * No hay contraseñas, cookies ni tokens propios que emitir.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usuariosService: UsuariosService) {
    const tenantId = process.env.TENANT_ID;
    const audience = [
      process.env.API_CLIENT_ID,
      process.env.API_APPLICATION_ID_URI,
    ].filter((value): value is string => Boolean(value));

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      issuer: [
        `https://login.microsoftonline.com/${tenantId}/v2.0`,
        `https://sts.windows.net/${tenantId}/`,
      ],
      audience,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
      }),
    });
  }

  async validate(payload: EntraTokenPayload): Promise<AuthenticatedUser> {
    const correo = payload.preferred_username ?? payload.upn ?? payload.email;

    if (!payload.oid || !correo) {
      throw new UnauthorizedException('Token sin los claims requeridos');
    }

    const usuario = await this.usuariosService.findOrCreateByOid({
      oid: payload.oid,
      correo,
      nombre: payload.name ?? correo,
    });

    if (usuario.estado !== EstadoUsuario.ACTIVO) {
      throw new UnauthorizedException('Acceso no autorizado');
    }

    return {
      id: usuario.idUsuario,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol.nombre,
      cargo: usuario.cargo ?? null,
      facultad: usuario.facultad ?? null,
    };
  }
}
