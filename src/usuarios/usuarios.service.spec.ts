import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsuariosService } from './usuarios.service';
import { EstadoUsuario, Usuario } from './entities/usuario.entity';
import { Rol } from 'src/roles/entities/rol.entity';

describe('UsuariosService', () => {
  let service: UsuariosService;
  let usuarioRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
    softRemove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let rolRepository: { findOne: jest.Mock };

  const UUID_ROL = 'b1f0c1d2-1111-4a2b-9c3d-000000000001';
  const UUID_USUARIO = 'b1f0c1d2-2222-4a2b-9c3d-000000000002';

  const rolEstudiante: Rol = { idRol: UUID_ROL, nombre: 'estudiante' };

  beforeEach(async () => {
    usuarioRepository = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) =>
        Promise.resolve({ ...data, idUsuario: UUID_USUARIO }),
      ),
      find: jest.fn(),
      update: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    rolRepository = { findOne: jest.fn() };

    const dataSourceMock = {
      getRepository: jest.fn((entity) => {
        if (entity === Rol) return rolRepository;
        return usuarioRepository;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
  });

  describe('registrarPublico', () => {
    const datos = {
      nombre: 'Estudiante Test',
      correo: 'estudiante@usantoto.edu.co',
      contrasena: '12345678',
    };

    it('lanza CONFLICT si el correo ya está registrado', async () => {
      usuarioRepository.findOne.mockResolvedValue({ idUsuario: UUID_USUARIO });

      await expect(service.registrarPublico(datos)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
    });

    it('lanza error si no existe el rol estudiante', async () => {
      usuarioRepository.findOne.mockResolvedValue(null);
      rolRepository.findOne.mockResolvedValue(null);

      await expect(service.registrarPublico(datos)).rejects.toBeInstanceOf(
        HttpException,
      );
    });

    it('crea el usuario con la contraseña hasheada y correoVerificado en false', async () => {
      usuarioRepository.findOne.mockResolvedValue(null);
      rolRepository.findOne.mockResolvedValue(rolEstudiante);

      const usuario = await service.registrarPublico(datos);

      expect(usuario.correoVerificado).toBe(false);
      expect(usuario.rol).toEqual(rolEstudiante);
      expect(usuario.contrasena).not.toBe(datos.contrasena);
      expect(await bcrypt.compare(datos.contrasena, usuario.contrasena)).toBe(
        true,
      );
    });
  });

  describe('registrarIntentoFallido', () => {
    const usuarioBase: Usuario = {
      idUsuario: UUID_USUARIO,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    } as Usuario;

    it('incrementa el contador sin bloquear antes del quinto intento', async () => {
      await service.registrarIntentoFallido({
        ...usuarioBase,
        intentosFallidos: 3,
      });

      expect(usuarioRepository.update).toHaveBeenCalledWith(UUID_USUARIO, {
        intentosFallidos: 4,
        bloqueadoHasta: null,
      });
    });

    it('bloquea la cuenta 15 minutos al llegar al quinto intento fallido', async () => {
      const antes = Date.now();
      await service.registrarIntentoFallido({
        ...usuarioBase,
        intentosFallidos: 4,
      });

      const llamada = usuarioRepository.update.mock.calls[0][1];
      expect(llamada.intentosFallidos).toBe(5);
      expect(llamada.bloqueadoHasta).toBeInstanceOf(Date);

      const minutosBloqueo = (llamada.bloqueadoHasta.getTime() - antes) / 60000;
      expect(minutosBloqueo).toBeGreaterThan(14);
      expect(minutosBloqueo).toBeLessThanOrEqual(15);
    });
  });

  describe('registrarLoginExitoso', () => {
    it('resetea intentos fallidos y desbloquea la cuenta', async () => {
      await service.registrarLoginExitoso(UUID_USUARIO);

      expect(usuarioRepository.update).toHaveBeenCalledWith(UUID_USUARIO, {
        intentosFallidos: 0,
        bloqueadoHasta: null,
      });
    });
  });

  describe('marcarCorreoVerificado', () => {
    it('marca correoVerificado en true', async () => {
      await service.marcarCorreoVerificado(UUID_USUARIO);

      expect(usuarioRepository.update).toHaveBeenCalledWith(UUID_USUARIO, {
        correoVerificado: true,
      });
    });
  });

  describe('findOne', () => {
    it('lanza NOT_FOUND si el usuario no existe', async () => {
      usuarioRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('id-que-no-existe')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('retorna el usuario con su rol si existe', async () => {
      const usuario = { idUsuario: UUID_USUARIO, estado: EstadoUsuario.ACTIVO };
      usuarioRepository.findOne.mockResolvedValue(usuario);

      await expect(service.findOne(UUID_USUARIO)).resolves.toEqual(usuario);
    });
  });
});
