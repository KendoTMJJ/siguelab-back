import { DataSource } from 'typeorm';
import { Laboratorio } from 'src/laboratorios/entities/laboratorio.entity';
import { Equipo } from 'src/equipos-laboratorio/entities/equipo.entity';
import { Servicio } from '../entities/servicio.entity';

/** Catálogo de servicios del Laboratorio de Fabricación Digital. Los tres
 * primeros tienen máquina dedicada (se enlazan a Equipo.idServicio abajo,
 * por prefijo de nombre); el resto no tiene equipo — son válidos igual,
 * solo que no sugieren una máquina puntual al solicitarlos. */
const SERVICIOS_FABRICACION_DIGITAL: Array<{
  nombre: string;
  prefijoEquipo?: string;
}> = [
  { nombre: 'Impresión 3D', prefijoEquipo: 'Impresora 3D' },
  { nombre: 'Corte láser', prefijoEquipo: 'Cortadora Láser' },
  { nombre: 'Escáner 3D', prefijoEquipo: 'Escáner 3D' },
  { nombre: 'Diseño' },
  { nombre: 'Prototipado' },
  { nombre: 'Ingeniería inversa' },
  { nombre: 'Otro' },
];

export async function seedServicios(dataSource: DataSource): Promise<void> {
  const laboratorioRepo = dataSource.getRepository(Laboratorio);
  const servicioRepo = dataSource.getRepository(Servicio);
  const equipoRepo = dataSource.getRepository(Equipo);

  const laboratorio = await laboratorioRepo.findOne({
    where: { nombre: 'Fabricación Digital' },
  });
  if (!laboratorio) {
    return;
  }

  for (const dato of SERVICIOS_FABRICACION_DIGITAL) {
    let servicio = await servicioRepo.findOne({
      where: { idLaboratorio: laboratorio.idLaboratorio, nombre: dato.nombre },
    });
    if (!servicio) {
      servicio = await servicioRepo.save(
        servicioRepo.create({
          idLaboratorio: laboratorio.idLaboratorio,
          nombre: dato.nombre,
        }),
      );
      console.log(`Servicio "${dato.nombre}" creado.`);
    }

    // Backfill: enlaza los equipos ya existentes cuyo nombre empiece con el
    // prefijo (ej. "Impresora 3D Creality K2 Plus" → "Impresión 3D") y que
    // todavía no tengan servicio asignado — sin esto, equipos sembrados
    // antes de que existiera esta tabla quedarían sin clasificar.
    if (dato.prefijoEquipo) {
      await equipoRepo
        .createQueryBuilder()
        .update(Equipo)
        .set({ idServicio: servicio.idServicio })
        .where('id_laboratorio = :idLab', { idLab: laboratorio.idLaboratorio })
        .andWhere('nombre LIKE :prefijo', { prefijo: `${dato.prefijoEquipo}%` })
        .andWhere('id_servicio IS NULL')
        .execute();
    }
  }
}
