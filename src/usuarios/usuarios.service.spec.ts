import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UsuariosService } from './usuarios.service';
import { EstadoUsuario, Usuario } from './entities/usuario.entity';
import { Rol } from 'src/roles/entities/rol.entity';
import { UpdateMeDto } from './dto/update-me.dto';

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

  const queryBuilderMock = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    queryBuilderMock.addSelect.mockReturnThis();
    queryBuilderMock.where.mockReturnThis();
    queryBuilderMock.update.mockReturnThis();
    queryBuilderMock.set.mockReturnThis();
    queryBuilderMock.execute.mockResolvedValue(undefined);

    usuarioRepository = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) =>
        Promise.resolve({ ...data, idUsuario: UUID_USUARIO }),
      ),
      find: jest.fn(),
      update: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn(() => queryBuilderMock),
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

  describe('update', () => {
    it('actualiza nombre/rol sin tocar el correo existente', async () => {
      const usuarioExistente = {
        idUsuario: UUID_USUARIO,
        nombre: 'Nombre Viejo',
        correo: 'original@usantoto.edu.co',
        estado: EstadoUsuario.ACTIVO,
      };
      usuarioRepository.findOne.mockResolvedValue(usuarioExistente);

      const actualizado = await service.update(UUID_USUARIO, {
        nombre: 'Nombre Nuevo',
      });

      expect(actualizado).toMatchObject({
        nombre: 'Nombre Nuevo',
        correo: 'original@usantoto.edu.co',
      });
    });

    it('el admin sí puede corregir el correo de otro usuario', async () => {
      const usuarioExistente = {
        idUsuario: UUID_USUARIO,
        nombre: 'Nombre Viejo',
        correo: 'viejo@usantoto.edu.co',
        estado: EstadoUsuario.ACTIVO,
      };
      usuarioRepository.findOne.mockResolvedValue(usuarioExistente);

      const actualizado = await service.update(UUID_USUARIO, {
        correo: 'corregido@usantoto.edu.co',
      });

      expect(actualizado).toMatchObject({
        correo: 'corregido@usantoto.edu.co',
      });
    });
  });

  describe('updateSelf', () => {
    const dtoBase: UpdateMeDto = {};

    it('lanza BAD_REQUEST si no se indica nombre ni nuevaContrasena', async () => {
      await expect(
        service.updateSelf(UUID_USUARIO, dtoBase),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('actualiza solo el nombre, sin tocar la contraseña', async () => {
      usuarioRepository.findOne.mockResolvedValue({
        idUsuario: UUID_USUARIO,
        nombre: 'Nombre Nuevo',
        correo: 'estudiante@usantoto.edu.co',
        rol: rolEstudiante,
      });

      const resultado = await service.updateSelf(UUID_USUARIO, {
        nombre: 'Nombre Nuevo',
      });

      expect(usuarioRepository.update).toHaveBeenCalledWith(UUID_USUARIO, {
        nombre: 'Nombre Nuevo',
      });
      expect(queryBuilderMock.getOne).not.toHaveBeenCalled();
      expect(resultado.nombre).toBe('Nombre Nuevo');
    });

    it('lanza BAD_REQUEST si pide nuevaContrasena sin contrasenaActual', async () => {
      await expect(
        service.updateSelf(UUID_USUARIO, { nuevaContrasena: 'Nueva12345' }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
      expect(queryBuilderMock.getOne).not.toHaveBeenCalled();
    });

    it('lanza NOT_FOUND si el usuario no existe al verificar la contraseña actual', async () => {
      queryBuilderMock.getOne.mockResolvedValue(null);

      await expect(
        service.updateSelf(UUID_USUARIO, {
          contrasenaActual: 'ActualCorrecta1',
          nuevaContrasena: 'Nueva12345',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    });

    it('lanza BAD_REQUEST si la contraseña actual no coincide', async () => {
      const hashActual = await bcrypt.hash('ActualCorrecta1', 10);
      queryBuilderMock.getOne.mockResolvedValue({ contrasena: hashActual });

      await expect(
        service.updateSelf(UUID_USUARIO, {
          contrasenaActual: 'Incorrecta',
          nuevaContrasena: 'Nueva12345',
        }),
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('cambia la contraseña si la actual coincide (reusa cambiarContrasena)', async () => {
      const hashActual = await bcrypt.hash('ActualCorrecta1', 10);
      queryBuilderMock.getOne.mockResolvedValue({ contrasena: hashActual });
      usuarioRepository.findOne.mockResolvedValue({
        idUsuario: UUID_USUARIO,
        nombre: 'Estudiante',
        correo: 'estudiante@usantoto.edu.co',
        rol: rolEstudiante,
      });

      await service.updateSelf(UUID_USUARIO, {
        contrasenaActual: 'ActualCorrecta1',
        nuevaContrasena: 'Nueva12345',
      });

      expect(queryBuilderMock.update).toHaveBeenCalledWith(Usuario);
      expect(queryBuilderMock.set).toHaveBeenCalledWith(
        expect.objectContaining({ tokenVersion: expect.any(Function) }),
      );
      expect(queryBuilderMock.execute).toHaveBeenCalled();
    });
  });
});

describe('UpdateMeDto', () => {
  it('rechaza cualquier intento de incluir correo (whitelist + forbidNonWhitelisted, ver src/main.ts)', async () => {
    const instancia = plainToInstance(UpdateMeDto, {
      nombre: 'Nombre Nuevo',
      correo: 'otro@usantoto.edu.co',
    });

    const errores = await validate(instancia, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(
      errores.some(
        (error) =>
          error.property === 'correo' && error.constraints?.whitelistValidation,
      ),
    ).toBe(true);
  });

  it('rechaza cualquier intento de incluir idRol (autoedición nunca cambia el rol)', async () => {
    const instancia = plainToInstance(UpdateMeDto, {
      idRol: 'b1f0c1d2-1111-4a2b-9c3d-000000000001',
    });

    const errores = await validate(instancia, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(
      errores.some(
        (error) =>
          error.property === 'idRol' && error.constraints?.whitelistValidation,
      ),
    ).toBe(true);
  });

  it('acepta nombre/contrasenaActual/nuevaContrasena sin errores', async () => {
    const instancia = plainToInstance(UpdateMeDto, {
      nombre: 'Nombre Nuevo',
    });

    const errores = await validate(instancia, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errores).toHaveLength(0);
  });
});
