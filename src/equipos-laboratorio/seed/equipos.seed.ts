import { DataSource } from 'typeorm';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';
import { Equipo } from '../entities/equipo.entity';

/** Catálogo de equipos del Laboratorio de Fabricación Digital, tal como lo
 * trae el documento de requerimientos. Cada unidad física es una fila propia
 * (por eso "Impresora 3D Creality Hi" aparece dos veces, no con cant.=2). */
const EQUIPOS_FABRICACION_DIGITAL: Array<{
  nombre: string;
  tecnologia: string;
}> = [
  {
    nombre: 'Impresora 3D Creality K2 Plus',
    tecnologia: 'FDM Multimaterial / Multicolor — Volumen: 350×350×350 mm',
  },
  {
    nombre: 'Impresora 3D Creality Hi (1)',
    tecnologia: 'FDM Alta Velocidad — Volumen: 220×220×250 mm',
  },
  {
    nombre: 'Impresora 3D Creality Hi (2)',
    tecnologia: 'FDM Alta Velocidad — Volumen: 220×220×250 mm',
  },
  {
    nombre: 'Impresora 3D Creality Ender 5 Plus',
    tecnologia: 'FDM — Volumen: 350×350×400 mm',
  },
  {
    nombre: 'Impresora 3D Creality Ender 3 V2',
    tecnologia: 'FDM — Volumen: 220×220×250 mm',
  },
  {
    nombre: 'Impresora 3D de Resina Creality Halot-X1',
    tecnologia: 'Resina (LCD UV 405 nm) — Volumen: 128×81×160 mm',
  },
  {
    nombre: 'Cortadora Láser Creality Falcon 2 Pro',
    tecnologia: 'Corte y grabado láser — Área útil: 400×415 mm',
  },
  {
    nombre: 'Escáner 3D Creality Raptor Pro',
    tecnologia:
      'Escaneo 3D por luz azul e infrarrojo — Rango: 5×5×5 mm a 2000×2000×2000 mm, precisión 0,02 mm',
  },
];

export async function seedEquipos(dataSource: DataSource): Promise<void> {
  const laboratorioRepo = dataSource.getRepository(Laboratorio);
  const equipoRepo = dataSource.getRepository(Equipo);

  const laboratorio = await laboratorioRepo.findOne({
    where: { nombre: 'Fabricación Digital' },
  });
  if (!laboratorio) {
    return;
  }

  for (const dato of EQUIPOS_FABRICACION_DIGITAL) {
    const existente = await equipoRepo.findOne({
      where: { idLaboratorio: laboratorio.idLaboratorio, nombre: dato.nombre },
    });
    if (!existente) {
      await equipoRepo.save(
        equipoRepo.create({
          ...dato,
          idLaboratorio: laboratorio.idLaboratorio,
        }),
      );
      console.log(`Equipo "${dato.nombre}" creado.`);
    }
  }
}
