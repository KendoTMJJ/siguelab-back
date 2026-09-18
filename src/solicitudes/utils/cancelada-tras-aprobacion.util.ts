/**
 * Fragmento SQL reutilizado en 4 consultas (SolicitudesService.
 * solicitudesAprobadasQueCruzan/disponibilidad/solicitudesPendientesDeBitacora
 * y BitacoraService.pendientesPorRegistrar): una solicitud CANCELADA cuenta
 * como "llegó a estar aprobada antes de cancelarse" cuando NINGUNA de sus
 * firmas quedó en un resultado distinto de aprobada (ni pendiente, ni
 * rechazada) — dato que no se toca al cancelar, así que se puede derivar sin
 * un estado ni una columna nueva.
 *
 * Regla de negocio (ver conversación con el usuario): una reserva que ya
 * llegó a `aprobada` NUNCA libera el laboratorio antes de que pase su fecha,
 * ni siquiera si el solicitante la cancela — a diferencia de rechazar o
 * cancelar mientras todavía está pendiente de firmas, donde nunca se aprobó
 * nada y el horario queda libre de inmediato (comportamiento que ya existía
 * y no cambia).
 *
 * Requiere un alias `solicitud` en la query que lo usa, y los parámetros
 * `cancelada` (EstadoSolicitud.CANCELADA) y `firmaAprobada`
 * (ResultadoFirma.APROBADA) — ver PARAMS_CANCELADA_TRAS_APROBACION.
 */
export const CONDICION_CANCELADA_TRAS_APROBACION =
  'solicitud.estado = :cancelada AND NOT EXISTS ' +
  '(SELECT 1 FROM firma f WHERE f.id_solicitud = solicitud.id_solicitud AND f.resultado != :firmaAprobada)';
