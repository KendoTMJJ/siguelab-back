/**
 * Columna E "Tiempo de Uso": horas decimales entre dos horas "HH:mm" o
 * "HH:mm:ss". En el archivo original es la fórmula `=(Dn-Cn)*24` — se
 * escribe aquí el valor numérico equivalente (Power Query lee valores de
 * celda, no fórmulas; ver EXPORT-NOTES.md para la verificación pendiente
 * contra Power Query real).
 */
export function calcularTiempoDeUso(
  horaInicio: string,
  horaFin: string,
): number {
  const minutos = (hora: string): number => {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  };
  const horas = (minutos(horaFin) - minutos(horaInicio)) / 60;
  return Math.round(horas * 100) / 100;
}
