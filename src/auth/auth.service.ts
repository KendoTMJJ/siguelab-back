import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { MailService } from 'src/mail/mail.service';
import { LoginDto } from './dto/login.dto';
import { RegistroDto } from './dto/registro.dto';
import { OlvidePasswordDto } from './dto/olvide-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ReenviarVerificacionDto } from './dto/reenviar-verificacion.dto';
import { Usuario } from 'src/usuarios/entities/usuario.entity';
import { JwtPayload } from './jwt/jwt-payload.interface';
import { TokenAuthService } from './token-auth.service';
import { TipoToken } from './entities/token-auth.entity';

@Injectable()
export class AuthService {
  constructor(
    private usuariosService: UsuariosService,
    private jwtService: JwtService,
    private mailService: MailService,
    private tokenAuthService: TokenAuthService,
  ) {}

  private dominioPermitido(correo: string): boolean {
    const dominios = String(process.env.ALLOWED_EMAIL_DOMAINS)
      .split(',')
      .map((d) => d.trim().toLowerCase());
    const dominioCorreo = correo.split('@')[1]?.toLowerCase();
    return dominios.includes(dominioCorreo);
  }

  private async enviarCorreoVerificacion(usuario: Usuario): Promise<void> {
    const tokenPlano = await this.tokenAuthService.generar(
      usuario,
      TipoToken.VERIFICACION,
      24 * 60,
    );

    const link = `${process.env.FRONTEND_URL}/verificar/${tokenPlano}`;
    await this.mailService.sendMail(
      usuario.correo,
      'Verifica tu correo - SIGELAB',
      `<p>Hola ${usuario.nombre}, confirma tu correo haciendo clic en el siguiente enlace (expira en 24h):</p>
       <p><a href="${link}">${link}</a></p>`,
    );
  }

  async registro(registroDto: RegistroDto) {
    if (!this.dominioPermitido(registroDto.correo)) {
      throw new HttpException(
        'El correo debe pertenecer a un dominio institucional',
        HttpStatus.BAD_REQUEST,
      );
    }

    const usuario = await this.usuariosService.registrarPublico(registroDto);
    await this.enviarCorreoVerificacion(usuario);

    return {
      mensaje: 'Registro exitoso. Revisa tu correo para verificar tu cuenta.',
    };
  }

  async reenviarVerificacion(dto: ReenviarVerificacionDto) {
    const usuario = await this.usuariosService.findByCorreo(dto.correo);

    if (usuario && !usuario.correoVerificado) {
      await this.enviarCorreoVerificacion(usuario);
    }

    return {
      mensaje:
        'Si el correo existe y no ha sido verificado, recibirás un nuevo enlace de verificación.',
    };
  }

  async verificarCorreo(tokenPlano: string) {
    const token = await this.tokenAuthService.consumir(
      tokenPlano,
      TipoToken.VERIFICACION,
    );

    if (!token) {
      throw new HttpException(
        'Token inválido o expirado',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.usuariosService.marcarCorreoVerificado(token.usuario.idUsuario);

    return { mensaje: 'Correo verificado correctamente.' };
  }

  async olvidePassword(dto: OlvidePasswordDto) {
    const usuario = await this.usuariosService.findByCorreo(dto.correo);

    if (usuario && usuario.correoVerificado) {
      const tokenPlano = await this.tokenAuthService.generar(
        usuario,
        TipoToken.RESET_PASSWORD,
        30,
      );

      const link = `${process.env.FRONTEND_URL}/reset-password/${tokenPlano}`;
      await this.mailService.sendMail(
        usuario.correo,
        'Recuperación de contraseña - SIGELAB',
        `<p>Hola ${usuario.nombre}, haz clic en el siguiente enlace para restablecer tu contraseña (expira en 30 minutos):</p>
         <p><a href="${link}">${link}</a></p>
         <p>Si no solicitaste esto, ignora este correo.</p>`,
      );
    }

    return {
      mensaje:
        'Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña.',
    };
  }

  async resetPassword(tokenPlano: string, dto: ResetPasswordDto) {
    const token = await this.tokenAuthService.consumir(
      tokenPlano,
      TipoToken.RESET_PASSWORD,
    );

    if (!token) {
      throw new HttpException(
        'Token inválido o expirado',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.usuariosService.cambiarContrasena(
      token.usuario.idUsuario,
      dto.contrasena,
    );

    return { mensaje: 'Contraseña actualizada correctamente.' };
  }

  async login(loginDto: LoginDto) {
    const usuario = await this.usuariosService.findByCorreo(loginDto.correo);

    if (!usuario) {
      throw new HttpException(
        'Credenciales inválidas',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      throw new HttpException(
        'Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta de nuevo más tarde.',
        HttpStatus.FORBIDDEN,
      );
    }

    const isMatch = await bcrypt.compare(
      loginDto.contrasena,
      usuario.contrasena,
    );

    if (!isMatch) {
      await this.usuariosService.registrarIntentoFallido(usuario);
      throw new HttpException(
        'Credenciales inválidas',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!usuario.correoVerificado) {
      throw new HttpException(
        'Debes verificar tu correo antes de iniciar sesión',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.usuariosService.registrarLoginExitoso(usuario.idUsuario);

    const payload: JwtPayload = {
      sub: usuario.idUsuario,
      correo: usuario.correo,
      rol: usuario.rol.nombre,
      tokenVersion: usuario.tokenVersion,
    };

    return {
      access_token: this.jwtService.sign(payload),
      usuario: {
        id: usuario.idUsuario,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol.nombre,
      },
    };
  }
}
