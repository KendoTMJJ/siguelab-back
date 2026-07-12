import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { MailService } from 'src/mail/mail.service';
import { TokenAuthService } from './token-auth.service';
import { TipoToken } from './entities/token-auth.entity';
import { EstadoUsuario, Usuario } from 'src/usuarios/entities/usuario.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usuariosService: Partial<Record<keyof UsuariosService, jest.Mock>>;
  let jwtService: Partial<Record<keyof JwtService, jest.Mock>>;
  let mailService: Partial<Record<keyof MailService, jest.Mock>>;
  let tokenAuthService: Partial<Record<keyof TokenAuthService, jest.Mock>>;

  const usuarioBase = (overrides: Partial<Usuario> = {}): Usuario =>
    ({
      idUsuario: 1,
      nombre: 'Test',
      correo: 'test@usantoto.edu.co',
      contrasena: 'hash-guardado',
      estado: EstadoUsuario.ACTIVO,
      correoVerificado: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      tokenVersion: 0,
      rol: { idRol: 6, nombre: 'estudiante' },
      ...overrides,
    }) as Usuario;

  beforeEach(async () => {
    process.env.ALLOWED_EMAIL_DOMAINS = 'usantoto.edu.co,ustatunja.edu.co';
    process.env.FRONTEND_URL = 'http://localhost:5173';

    usuariosService = {
      findByCorreo: jest.fn(),
      registrarPublico: jest.fn(),
      registrarIntentoFallido: jest.fn(),
      registrarLoginExitoso: jest.fn(),
      marcarCorreoVerificado: jest.fn(),
      cambiarContrasena: jest.fn(),
    };
    jwtService = { sign: jest.fn().mockReturnValue('jwt-firmado') };
    mailService = { sendMail: jest.fn() };
    tokenAuthService = { generar: jest.fn(), consumir: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsuariosService, useValue: usuariosService },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mailService },
        { provide: TokenAuthService, useValue: tokenAuthService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('rechaza con 401 si el usuario no existe', async () => {
      usuariosService.findByCorreo!.mockResolvedValue(null);

      await expect(
        service.login({ correo: 'x@usantoto.edu.co', contrasena: 'x' }),
      ).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });
    });

    it('rechaza con 403 si la cuenta está bloqueada, incluso con clave correcta', async () => {
      const hash = await bcrypt.hash('correcta', 10);
      usuariosService.findByCorreo!.mockResolvedValue(
        usuarioBase({
          contrasena: hash,
          bloqueadoHasta: new Date(Date.now() + 60_000),
        }),
      );

      await expect(
        service.login({
          correo: 'test@usantoto.edu.co',
          contrasena: 'correcta',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    });

    it('registra intento fallido y rechaza con 401 si la contraseña no coincide', async () => {
      const hash = await bcrypt.hash('correcta', 10);
      const usuario = usuarioBase({ contrasena: hash });
      usuariosService.findByCorreo!.mockResolvedValue(usuario);

      await expect(
        service.login({
          correo: 'test@usantoto.edu.co',
          contrasena: 'incorrecta',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });

      expect(usuariosService.registrarIntentoFallido).toHaveBeenCalledWith(
        usuario,
      );
    });

    it('rechaza con 403 si el correo no está verificado', async () => {
      const hash = await bcrypt.hash('correcta', 10);
      usuariosService.findByCorreo!.mockResolvedValue(
        usuarioBase({ contrasena: hash, correoVerificado: false }),
      );

      await expect(
        service.login({
          correo: 'test@usantoto.edu.co',
          contrasena: 'correcta',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    });

    it('devuelve el access_token y resetea intentos en un login exitoso', async () => {
      const hash = await bcrypt.hash('correcta', 10);
      const usuario = usuarioBase({ contrasena: hash });
      usuariosService.findByCorreo!.mockResolvedValue(usuario);

      const resultado = await service.login({
        correo: 'test@usantoto.edu.co',
        contrasena: 'correcta',
      });

      expect(resultado.access_token).toBe('jwt-firmado');
      expect(resultado.usuario.correo).toBe(usuario.correo);
      expect(usuariosService.registrarLoginExitoso).toHaveBeenCalledWith(
        usuario.idUsuario,
      );
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: usuario.idUsuario,
          rol: 'estudiante',
          tokenVersion: 0,
        }),
      );
    });
  });

  describe('registro', () => {
    it('rechaza correos fuera del dominio institucional', async () => {
      await expect(
        service.registro({
          nombre: 'X',
          correo: 'x@gmail.com',
          contrasena: '12345678',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });

      expect(usuariosService.registrarPublico).not.toHaveBeenCalled();
    });

    it('registra, genera token de verificación y envía el correo', async () => {
      const usuario = usuarioBase({ correoVerificado: false });
      usuariosService.registrarPublico!.mockResolvedValue(usuario);
      tokenAuthService.generar!.mockResolvedValue('token-plano');

      const resultado = await service.registro({
        nombre: usuario.nombre,
        correo: usuario.correo,
        contrasena: '12345678',
      });

      expect(tokenAuthService.generar).toHaveBeenCalledWith(
        usuario,
        TipoToken.VERIFICACION,
        24 * 60,
      );
      expect(mailService.sendMail).toHaveBeenCalledWith(
        usuario.correo,
        expect.any(String),
        expect.stringContaining('token-plano'),
      );
      expect(resultado.mensaje).toContain('Registro exitoso');
    });
  });

  describe('verificarCorreo', () => {
    it('lanza error si el token es inválido o expirado', async () => {
      tokenAuthService.consumir!.mockResolvedValue(null);

      await expect(service.verificarCorreo('token')).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('marca el correo como verificado si el token es válido', async () => {
      const usuario = usuarioBase();
      tokenAuthService.consumir!.mockResolvedValue({ usuario });

      await service.verificarCorreo('token-valido');

      expect(usuariosService.marcarCorreoVerificado).toHaveBeenCalledWith(
        usuario.idUsuario,
      );
    });
  });

  describe('olvidePassword', () => {
    it('responde el mismo mensaje exista o no el correo, sin enviar correo si no existe', async () => {
      usuariosService.findByCorreo!.mockResolvedValue(null);

      const resultado = await service.olvidePassword({
        correo: 'noexiste@usantoto.edu.co',
      });

      expect(mailService.sendMail).not.toHaveBeenCalled();
      expect(resultado.mensaje).toContain('Si el correo existe');
    });

    it('genera token y envía correo si el usuario existe y está verificado', async () => {
      const usuario = usuarioBase();
      usuariosService.findByCorreo!.mockResolvedValue(usuario);
      tokenAuthService.generar!.mockResolvedValue('token-reset');

      await service.olvidePassword({ correo: usuario.correo });

      expect(tokenAuthService.generar).toHaveBeenCalledWith(
        usuario,
        TipoToken.RESET_PASSWORD,
        30,
      );
      expect(mailService.sendMail).toHaveBeenCalled();
    });

    it('no envía correo si el usuario existe pero no ha verificado su correo', async () => {
      usuariosService.findByCorreo!.mockResolvedValue(
        usuarioBase({ correoVerificado: false }),
      );

      await service.olvidePassword({ correo: 'test@usantoto.edu.co' });

      expect(mailService.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('lanza error si el token es inválido o expirado', async () => {
      tokenAuthService.consumir!.mockResolvedValue(null);

      await expect(
        service.resetPassword('token', { contrasena: '12345678' }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('cambia la contraseña si el token es válido', async () => {
      const usuario = usuarioBase();
      tokenAuthService.consumir!.mockResolvedValue({ usuario });

      await service.resetPassword('token-valido', {
        contrasena: 'NuevaClave123',
      });

      expect(usuariosService.cambiarContrasena).toHaveBeenCalledWith(
        usuario.idUsuario,
        'NuevaClave123',
      );
    });
  });
});
