import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { TokenAuthService } from './token-auth.service';
import { TipoToken } from './entities/token-auth.entity';
import { Usuario } from 'src/usuarios/entities/usuario.entity';

describe('TokenAuthService', () => {
  let service: TokenAuthService;
  let tokenRepository: {
    update: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };

  const usuario = { idUsuario: 'uuid-usuario-1' } as Usuario;

  beforeEach(async () => {
    tokenRepository = {
      update: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve(data)),
      findOne: jest.fn(),
    };

    const dataSourceMock = {
      getRepository: jest.fn(() => tokenRepository),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenAuthService,
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<TokenAuthService>(TokenAuthService);
  });

  describe('generar', () => {
    it('invalida los tokens pendientes del mismo usuario y tipo antes de crear uno nuevo', async () => {
      await service.generar(usuario, TipoToken.VERIFICACION, 24 * 60);

      expect(tokenRepository.update).toHaveBeenCalledWith(
        {
          usuario: { idUsuario: usuario.idUsuario },
          tipo: TipoToken.VERIFICACION,
          usado: false,
        },
        { usado: true },
      );
    });

    it('retorna el token plano, pero guarda un hash distinto en la base de datos', async () => {
      const tokenPlano = await service.generar(
        usuario,
        TipoToken.VERIFICACION,
        24 * 60,
      );

      const tokenGuardado = tokenRepository.save.mock.calls[0][0];

      expect(typeof tokenPlano).toBe('string');
      expect(tokenGuardado.tokenHash).not.toBe(tokenPlano);
      expect(tokenGuardado.tokenHash).toHaveLength(64); // SHA-256 en hex = 64 caracteres
    });

    it('calcula la expiración según los minutos indicados', async () => {
      const antes = Date.now();

      await service.generar(usuario, TipoToken.RESET_PASSWORD, 30);

      const tokenGuardado = tokenRepository.save.mock.calls[0][0];
      const minutosReales = (tokenGuardado.expiraEn.getTime() - antes) / 60000;

      expect(minutosReales).toBeGreaterThan(29);
      expect(minutosReales).toBeLessThanOrEqual(30.1); // margen por el tiempo real que tarda en ejecutarse
    });
  });

  describe('consumir', () => {
    it('retorna null si no encuentra ningún token que coincida', async () => {
      tokenRepository.findOne.mockResolvedValue(null);

      const resultado = await service.consumir(
        'token-inexistente',
        TipoToken.VERIFICACION,
      );

      expect(resultado).toBeNull();
    });

    it('retorna null si el token existe pero ya expiró', async () => {
      tokenRepository.findOne.mockResolvedValue({
        expiraEn: new Date(Date.now() - 1000), // 1 segundo en el pasado
        usado: false,
      });

      const resultado = await service.consumir(
        'token-expirado',
        TipoToken.VERIFICACION,
      );

      expect(resultado).toBeNull();
      expect(tokenRepository.save).not.toHaveBeenCalled();
    });

    it('marca el token como usado y lo retorna si es válido', async () => {
      const tokenEncontrado = {
        expiraEn: new Date(Date.now() + 60_000), // 1 minuto en el futuro
        usado: false,
        usuario,
      };
      tokenRepository.findOne.mockResolvedValue(tokenEncontrado);

      const resultado = await service.consumir(
        'token-valido',
        TipoToken.VERIFICACION,
      );

      expect(resultado?.usado).toBe(true);
      expect(tokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ usado: true }),
      );
    });
  });
});
