import { DataSource } from 'typeorm';
import { EstadoSolicitud, SolicitudReserva } from 'src/solicitudes/entities/solicitud-reserva.entity';
import {
  SolicitudEvento,
  TipoEventoSolicitud,
} from 'src/solicitudes/entities/solicitud-evento.entity';

/**
 * Backfill idempotente: reconstruye solicitud_evento para solicitudes creadas
 * ANTES de que existiera esta tabla, a partir de las columnas que ya
 * teníamos (fecha_creacion, firmas, motivo_cancelacion/estado). Corre en
 * cada arranque pero solo hace trabajo real la primera vez — la condición
 * "sin eventos todavía" hace que las siguientes corridas no encuentren nada
 * que migrar.
 *
 * Limitación conocida y a propósito no disimulada: para solicitudes
 * canceladas antes de este cambio, nunca se guardó quién canceló ni cuándo
 * (motivo_cancelacion existía, pero no la fecha ni el actor) — el evento
 * CANCELADA reconstruido usa fecha_creacion como fecha aproximada e
 * idActor null. Las solicitudes canceladas DESPUÉS de este cambio sí quedan
 * con fecha y actor reales (ver SolicitudesService.cancelar).
 */
export async function backfillEventosSolicitud(
  dataSource: DataSource,
): Promise<void> {
  const solicitudRepository = dataSource.getRepository(SolicitudReserva);
  const eventoRepository = dataSource.getRepository(SolicitudEvento);

  const solicitudesSinEventos = await solicitudRepository
    .createQueryBuilder('solicitud')
    .leftJoinAndSelect('solicitud.firmas', 'firmas')
    .leftJoin('solicitud.eventos', 'eventos')
    .where('eventos.id_evento IS NULL')
    .getMany();

  if (solicitudesSinEventos.length === 0) {
    return;
  }

  for (const solicitud of solicitudesSinEventos) {
    const eventos: Partial<SolicitudEvento>[] = [
      {
        idSolicitud: solicitud.idSolicitud,
        tipo: TipoEventoSolicitud.CREADA,
        idActor: solicitud.idSolicitante,
        fecha: solicitud.fechaCreacion,
      },
    ];

    const firmasOrdenadas = [...solicitud.firmas].sort(
      (a, b) => a.orden - b.orden,
    );
    for (const firma of firmasOrdenadas) {
      if (firma.resultado === 'pendiente') {
        continue;
      }
      const esDocente = firma.rolFirmante === 'docente';
      const tipo = esDocente
        ? firma.resultado === 'aprobada'
          ? TipoEventoSolicitud.FIRMA_DOCENTE_APROBADA
          : TipoEventoSolicitud.FIRMA_DOCENTE_RECHAZADA
        : firma.resultado === 'aprobada'
          ? TipoEventoSolicitud.FIRMA_LABORATORISTA_APROBADA
          : TipoEventoSolicitud.FIRMA_LABORATORISTA_RECHAZADA;

      eventos.push({
        idSolicitud: solicitud.idSolicitud,
        tipo,
        idActor: firma.idFirmante ?? null,
        detalle: firma.observacion ?? null,
        fecha: firma.fechaHora ?? solicitud.fechaCreacion,
      });
    }

    if (solicitud.estado === EstadoSolicitud.CANCELADA) {
      eventos.push({
        idSolicitud: solicitud.idSolicitud,
        tipo: TipoEventoSolicitud.CANCELADA,
        idActor: null,
        detalle: solicitud.motivoCancelacion ?? null,
        fecha: solicitud.fechaCreacion,
      });
    }

    await eventoRepository.save(eventoRepository.create(eventos));
  }

  console.log(
    `Backfill de trazabilidad: ${solicitudesSinEventos.length} solicitud(es) migradas a solicitud_evento.`,
  );
}
