import { calcularSemana } from './calcular-semana.util';

describe('calcularSemana', () => {
  const periodo = {
    fechaInicio: '2026-07-20',
    fechaFin: '2026-11-20',
    numSemanas: 16,
  };

  it('la fecha de inicio del periodo es la semana 1', () => {
    expect(calcularSemana('2026-07-20', periodo)).toBe(1);
  });

  it('7 días después sigue siendo semana 1 (el corte es al día 7, no antes)', () => {
    expect(calcularSemana('2026-07-26', periodo)).toBe(1);
  });

  it('el día 8 ya es semana 2', () => {
    expect(calcularSemana('2026-07-27', periodo)).toBe(2);
  });

  it('devuelve "Intersemestral" antes de que empiece el periodo', () => {
    expect(calcularSemana('2026-07-19', periodo)).toBe('Intersemestral');
  });

  it('devuelve "Intersemestral" después de que termine el periodo', () => {
    expect(calcularSemana('2026-11-21', periodo)).toBe('Intersemestral');
  });

  it('devuelve "Intersemestral" si el cálculo supera num_semanas aunque la fecha esté dentro del rango', () => {
    const periodoCorto = {
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      numSemanas: 2,
    };
    expect(calcularSemana('2026-01-20', periodoCorto)).toBe('Intersemestral');
  });
});
