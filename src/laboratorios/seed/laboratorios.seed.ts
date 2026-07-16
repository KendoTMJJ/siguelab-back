import { DataSource } from 'typeorm';
import { Laboratorio } from '../entities/laboratorio.entity';

const LABORATORIOS_BASE: Array<{ nombre: string; capacidad: number }> = [
  { nombre: 'Lab. Electrónica Digital', capacidad: 24 },
  { nombre: 'Lab. Telecomunicaciones', capacidad: 20 },
  { nombre: 'Lab. Circuitos', capacidad: 24 },
  { nombre: 'Lab. Automatización', capacidad: 18 },
  { nombre: 'Lab. Física', capacidad: 30 },
  { nombre: 'Lab. Química', capacidad: 20 },
  { nombre: 'Lab. Hidráulica', capacidad: 16 },
  { nombre: 'Lab. Geotecnia', capacidad: 16 },
  { nombre: 'Lab. Materiales', capacidad: 16 },
  { nombre: 'Sala de Semillero 1', capacidad: 12 },
  { nombre: 'Módulo de Investigación', capacidad: 10 },
];

/**
 * No siembra asociaciones (espacio_laboratorio / docente_laboratorio):
 * las carga el admin gradualmente vía API.
 */
export async function seedLaboratorios(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(Laboratorio);

  for (const dato of LABORATORIOS_BASE) {
    const existente = await repo.findOne({ where: { nombre: dato.nombre } });
    if (!existente) {
      await repo.save(repo.create(dato));
      console.log(`Laboratorio "${dato.nombre}" creado.`);
    }
  }
}
