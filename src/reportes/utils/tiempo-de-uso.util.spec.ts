import { calcularTiempoDeUso } from './tiempo-de-uso.util';

describe('calcularTiempoDeUso', () => {
  it('calcula horas decimales entre dos horas exactas', () => {
    expect(calcularTiempoDeUso('08:00', '10:00')).toBe(2);
  });

  it('calcula fracciones de hora correctamente', () => {
    expect(calcularTiempoDeUso('08:30', '10:00')).toBe(1.5);
  });

  it('acepta horas con segundos ("HH:mm:ss", como llegan de la BD)', () => {
    expect(calcularTiempoDeUso('08:00:00', '09:15:00')).toBe(1.25);
  });

  it('redondea a 2 decimales', () => {
    expect(calcularTiempoDeUso('08:00', '08:20')).toBe(0.33);
  });
});
