import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DataSource, LessThan, Repository } from 'typeorm';
import { MailService } from 'src/mail/mail.service';
import { SolicitudReserva } from 'src/solicitudes/entities/solicitud-reserva.entity';
import {
  EstadoNotificacion,
  Notificacion,
  TipoEventoNotificacion,
} from './entities/notificacion.entity';

export interface DestinatarioNotificacion {
  idUsuario: string;
  correo: string;
}

/** Cuántas veces reintentar un correo antes de darlo por `fallida`. */
const MAX_INTENTOS = 3;
/** Cuántas notificaciones pendientes procesa cada corrida del cron — un
 * lote chico para no acaparar el proceso si se junta un pico. */
const LOTE_MAXIMO = 20;

const ASUNTOS: Record<TipoEventoNotificacion, string> = {
  [TipoEventoNotificacion.SOLICITUD_ENVIADA]:
    'Tu solicitud de reserva fue enviada',
  [TipoEventoNotificacion.SOLICITUD_CREADA]:
    'Nueva solicitud de reserva pendiente de tu firma',
  [TipoEventoNotificacion.PENDIENTE_FIRMA]:
    'Tienes una solicitud pendiente de firma',
  [TipoEventoNotificacion.FIRMA_APROBADA]:
    'Tu solicitud avanzó a la siguiente firma',
  [TipoEventoNotificacion.SOLICITUD_APROBADA]:
    'Tu solicitud de reserva fue aprobada',
  [TipoEventoNotificacion.SOLICITUD_RECHAZADA]:
    'Tu solicitud de reserva fue rechazada',
  [TipoEventoNotificacion.SOLICITUD_CANCELADA]:
    'Tu solicitud de reserva fue cancelada',
  [TipoEventoNotificacion.SOLICITUD_CANCELADA_DOCENTE]:
    'Un estudiante canceló una reserva aprobada',
  [TipoEventoNotificacion.BITACORA_PENDIENTE]:
    'Tienes un registro de bitácora pendiente',
  [TipoEventoNotificacion.SERVICIO_SOLICITADO]:
    'Nueva solicitud de servicio técnico',
  [TipoEventoNotificacion.SERVICIO_COTIZADO]:
    'Tu servicio técnico ya tiene cotización',
  [TipoEventoNotificacion.SERVICIO_APROBADO]:
    'Cotización aprobada — servicio listo para programar',
  [TipoEventoNotificacion.SERVICIO_RECHAZADO]: 'Cotización rechazada',
  [TipoEventoNotificacion.SERVICIO_PROGRAMADO]:
    'Tu servicio técnico ya tiene fecha y hora',
  [TipoEventoNotificacion.SERVICIO_ENTREGADO]:
    'Tu servicio técnico fue entregado',
  [TipoEventoNotificacion.SERVICIO_CANCELADO]: 'Servicio técnico cancelado',
  [TipoEventoNotificacion.EVENTO_SOLICITADO]:
    'Nueva solicitud de evento especial',
  [TipoEventoNotificacion.EVENTO_APROBADO]: 'Tu evento especial fue aprobado',
  [TipoEventoNotificacion.EVENTO_RECHAZADO]: 'Tu evento especial fue rechazado',
  [TipoEventoNotificacion.EVENTO_CANCELADO]: 'Evento especial cancelado',
};

/** Frase de introducción del correo, según el evento. */
const MENSAJES: Record<TipoEventoNotificacion, string> = {
  // Genérico a propósito: aplica tanto si crea un estudiante (sigue el
  // docente) como si crea un docente directo (sigue el laboratorista, sin
  // paso intermedio) — ver SolicitudesService.create.
  [TipoEventoNotificacion.SOLICITUD_ENVIADA]:
    'Tu solicitud de reserva se envió correctamente y quedó registrada, a la espera de la primera firma.',
  [TipoEventoNotificacion.SOLICITUD_CREADA]:
    'Recibiste una nueva solicitud de reserva que necesita tu firma como docente encargado.',
  [TipoEventoNotificacion.PENDIENTE_FIRMA]:
    'Hay una solicitud de reserva aprobada por el docente y pendiente de tu firma como laboratorista.',
  [TipoEventoNotificacion.FIRMA_APROBADA]:
    'Tu solicitud avanzó: una firma fue aprobada y pasó a la siguiente etapa del flujo.',
  [TipoEventoNotificacion.SOLICITUD_APROBADA]:
    '¡Tu solicitud de reserva fue aprobada! El laboratorio queda reservado para la fecha y el horario indicados.',
  [TipoEventoNotificacion.SOLICITUD_RECHAZADA]:
    'Lamentamos informarte que tu solicitud de reserva fue rechazada.',
  [TipoEventoNotificacion.SOLICITUD_CANCELADA]:
    'Tu solicitud de reserva fue cancelada.',
  [TipoEventoNotificacion.SOLICITUD_CANCELADA_DOCENTE]:
    'El estudiante canceló una reserva que ya estaba aprobada para tu asignatura. El laboratorio se mantiene bloqueado hasta la fecha original — no queda disponible para nadie más en ese horario.',
  [TipoEventoNotificacion.BITACORA_PENDIENTE]:
    'La fecha de esta reserva ya pasó y todavía no se registró el uso real en bitácora. Ingresa para completarlo.',
  [TipoEventoNotificacion.SERVICIO_SOLICITADO]:
    'Alguien quiere usar el laboratorio: hay una nueva solicitud de servicio técnico esperando revisión y cotización.',
  [TipoEventoNotificacion.SERVICIO_COTIZADO]:
    'Ya armamos la cotización de tu servicio — entrá a revisarla y aprobarla o rechazarla.',
  [TipoEventoNotificacion.SERVICIO_APROBADO]:
    'El solicitante aprobó la cotización — el servicio ya se puede programar.',
  [TipoEventoNotificacion.SERVICIO_RECHAZADO]:
    'El solicitante rechazó la cotización.',
  [TipoEventoNotificacion.SERVICIO_PROGRAMADO]:
    'Tu servicio técnico ya tiene fecha y horario asignados.',
  [TipoEventoNotificacion.SERVICIO_ENTREGADO]:
    '¡Tu servicio técnico fue entregado! Ya puedes retirar el resultado.',
  [TipoEventoNotificacion.SERVICIO_CANCELADO]:
    'El servicio técnico fue cancelado.',
  [TipoEventoNotificacion.EVENTO_SOLICITADO]:
    'Alguien quiere usar el laboratorio: hay una nueva solicitud de evento especial esperando aprobación.',
  [TipoEventoNotificacion.EVENTO_APROBADO]:
    '¡Tu evento especial fue aprobado! Queda reservado para la fecha y el horario indicados.',
  [TipoEventoNotificacion.EVENTO_RECHAZADO]:
    'Lamentamos informarte que tu evento especial fue rechazado.',
  [TipoEventoNotificacion.EVENTO_CANCELADO]:
    'El evento especial fue cancelado.',
};

/** El color del encabezado cambia según el tono del evento (aprobado/rechazado/neutro). */
const COLOR_EVENTO: Record<TipoEventoNotificacion, string> = {
  [TipoEventoNotificacion.SOLICITUD_ENVIADA]: '#004f9f',
  [TipoEventoNotificacion.SOLICITUD_CREADA]: '#004f9f',
  [TipoEventoNotificacion.PENDIENTE_FIRMA]: '#004f9f',
  [TipoEventoNotificacion.FIRMA_APROBADA]: '#004f9f',
  [TipoEventoNotificacion.SOLICITUD_APROBADA]: '#0ca30c',
  [TipoEventoNotificacion.SOLICITUD_RECHAZADA]: '#d03b3b',
  [TipoEventoNotificacion.SOLICITUD_CANCELADA]: '#71717a',
  [TipoEventoNotificacion.SOLICITUD_CANCELADA_DOCENTE]: '#71717a',
  [TipoEventoNotificacion.BITACORA_PENDIENTE]: '#b45309',
  [TipoEventoNotificacion.SERVICIO_SOLICITADO]: '#004f9f',
  [TipoEventoNotificacion.SERVICIO_COTIZADO]: '#004f9f',
  [TipoEventoNotificacion.SERVICIO_APROBADO]: '#0ca30c',
  [TipoEventoNotificacion.SERVICIO_RECHAZADO]: '#d03b3b',
  [TipoEventoNotificacion.SERVICIO_PROGRAMADO]: '#004f9f',
  [TipoEventoNotificacion.SERVICIO_ENTREGADO]: '#0ca30c',
  [TipoEventoNotificacion.SERVICIO_CANCELADO]: '#71717a',
  [TipoEventoNotificacion.EVENTO_SOLICITADO]: '#004f9f',
  [TipoEventoNotificacion.EVENTO_APROBADO]: '#0ca30c',
  [TipoEventoNotificacion.EVENTO_RECHAZADO]: '#d03b3b',
  [TipoEventoNotificacion.EVENTO_CANCELADO]: '#71717a',
};

/** Evita que texto libre (nombre de práctica, motivo) rompa el HTML del correo. */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 'HH:mm:ss' (columna time de MySQL) -> 'HH:mm'. */
function hhmm(hora: string): string {
  return hora.slice(0, 5);
}

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);
  private readonly notificacionRepository: Repository<Notificacion>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
  ) {
    this.notificacionRepository = this.dataSource.getRepository(Notificacion);
  }

  /**
   * Inserta una notificación por destinatario, en estado `pendiente` — el
   * envío real del correo NO pasa acá. Antes este método esperaba (`await`)
   * a que el SMTP terminara antes de devolver la respuesta HTTP al que
   * creó/firmó/etc. la solicitud; con SMTP lento eso podía colgar el
   * request varios segundos (o más) aunque la solicitud ya estuviera
   * guardada. Ahora arma el correo (asunto + HTML, es trabajo síncrono, sin
   * red) y lo deja listo en la tabla — `enviarPendientes()` (disparado por
   * cron, ver NotificacionesScheduler) es quien de verdad lo manda, en otro
   * momento, sin bloquear a nadie.
   */
  async notificar(
    tipoEvento: TipoEventoNotificacion,
    solicitud: SolicitudReserva,
    destinatarios: DestinatarioNotificacion[],
    motivo?: string,
    /** Ruta (relativa a FRONTEND_URL) del botón del correo, ej.
     * `/bitacora/nuevo?idSolicitud=5` — solo BITACORA_PENDIENTE la usa hoy,
     * para llevar directo al registro en vez del genérico "Ver en Siguelab".
     * undefined mantiene el link genérico de siempre. */
    linkPath?: string,
  ): Promise<void> {
    const cuerpoHtml = this.construirCuerpo(tipoEvento, solicitud, motivo, linkPath);
    await this.encolar(
      tipoEvento,
      { idSolicitud: solicitud.idSolicitud },
      destinatarios,
      cuerpoHtml,
    );
  }

  private construirCuerpo(
    tipoEvento: TipoEventoNotificacion,
    solicitud: SolicitudReserva,
    motivo?: string,
    linkPath?: string,
  ): string {
    const filas: Array<{ etiqueta: string; valor: string }> = [
      { etiqueta: 'Práctica', valor: escaparHtml(solicitud.nombrePractica) },
      { etiqueta: 'Fecha', valor: escaparHtml(solicitud.fechaPractica) },
      {
        etiqueta: 'Horario',
        valor: `${hhmm(solicitud.horaInicio)} – ${hhmm(solicitud.horaFin)}`,
      },
      { etiqueta: 'N.º de personas', valor: String(solicitud.numPersonas) },
    ];
    const motivoRechazo =
      tipoEvento === TipoEventoNotificacion.SOLICITUD_RECHAZADA && motivo
        ? escaparHtml(motivo)
        : undefined;

    return this.plantillaHtml(
      tipoEvento,
      `Solicitud #${solicitud.idSolicitud}`,
      filas,
      motivoRechazo,
      linkPath,
    );
  }

  /**
   * Igual que `notificar()`, pero para un origen que no es SolicitudReserva
   * (servicio técnico o evento especial) — el llamador arma el cuerpo
   * (filas clave/valor) en vez de depender de los campos fijos de
   * SolicitudReserva. También solo encola: el envío real lo hace
   * `enviarPendientes()`.
   */
  async notificarGenerico(
    tipoEvento: TipoEventoNotificacion,
    origen: { idServicio: number } | { idEvento: number },
    destinatarios: DestinatarioNotificacion[],
    refLabel: string,
    filas: Array<{ etiqueta: string; valor: string }>,
    motivo?: string,
  ): Promise<void> {
    const cuerpoHtml = this.plantillaHtml(tipoEvento, refLabel, filas, motivo);
    await this.encolar(tipoEvento, origen, destinatarios, cuerpoHtml);
  }

  /** Inserta una fila `pendiente` por destinatario — compartido por
   * `notificar()` y `notificarGenerico()`. */
  private async encolar(
    tipoEvento: TipoEventoNotificacion,
    origen:
      { idSolicitud: number } | { idServicio: number } | { idEvento: number },
    destinatarios: DestinatarioNotificacion[],
    cuerpoHtml: string,
  ): Promise<void> {
    const notificaciones = destinatarios.map((destinatario) =>
      this.notificacionRepository.create({
        ...origen,
        idDestinatario: destinatario.idUsuario,
        tipoEvento,
        asunto: ASUNTOS[tipoEvento],
        cuerpoHtml,
        estado: EstadoNotificacion.PENDIENTE,
      }),
    );
    await this.notificacionRepository.save(notificaciones);
  }

  /**
   * El worker de verdad — lo dispara NotificacionesScheduler por cron.
   * Toma un lote de notificaciones `pendientes`, intenta mandarlas, y
   * actualiza cada una a `enviada` o, si se agotaron los reintentos, a
   * `fallida`. Un fallo acá nunca vuelve a tocar la solicitud/servicio/
   * evento que la generó — esa parte ya terminó hace rato.
   */
  async enviarPendientes(): Promise<void> {
    const pendientes = await this.notificacionRepository.find({
      where: {
        estado: EstadoNotificacion.PENDIENTE,
        intentos: LessThan(MAX_INTENTOS),
      },
      relations: { destinatario: true },
      order: { idNotificacion: 'ASC' },
      take: LOTE_MAXIMO,
    });

    for (const notificacion of pendientes) {
      try {
        await this.mailService.sendMail(
          notificacion.destinatario.correo,
          notificacion.asunto,
          notificacion.cuerpoHtml,
        );
        notificacion.estado = EstadoNotificacion.ENVIADA;
      } catch (error) {
        notificacion.intentos += 1;
        notificacion.estado =
          notificacion.intentos >= MAX_INTENTOS
            ? EstadoNotificacion.FALLIDA
            : EstadoNotificacion.PENDIENTE;
        this.logger.error(
          `Fallo al enviar notificación #${notificacion.idNotificacion} (${notificacion.tipoEvento}) a ${notificacion.destinatario.correo} — intento ${notificacion.intentos}/${MAX_INTENTOS}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
      await this.notificacionRepository.save(notificacion);
    }
  }

  /**
   * Plantilla de correo con estilos EN LÍNEA y layout basado en tablas —
   * es la única forma confiable de que se vea igual en Gmail/Outlook, que
   * ignoran <style> y muchas propiedades modernas de CSS.
   */
  private plantillaHtml(
    tipoEvento: TipoEventoNotificacion,
    refLabel: string,
    filas: Array<{ etiqueta: string; valor: string }>,
    motivoRechazo?: string,
    linkPath?: string,
  ): string {
    const color = COLOR_EVENTO[tipoEvento];
    const titulo = ASUNTOS[tipoEvento];
    const intro = MENSAJES[tipoEvento];
    const appUrl = process.env.FRONTEND_URL || '';
    // Con linkPath, el botón lleva directo a la acción pendiente (ej.
    // /bitacora/nuevo?idSolicitud=5) en vez del genérico "Ver en Siguelab".
    const botonHref = linkPath ? `${appUrl}${linkPath}` : appUrl;
    const botonTexto = linkPath ? 'Registrar uso' : 'Ver en Siguelab';

    const filasHtml = filas
      .map(
        ({ etiqueta, valor }, i) => `
          <tr>
            <td style="padding:10px 16px;${i > 0 ? 'border-top:1px solid #eceff3;' : ''}font-size:13px;color:#6b7280;white-space:nowrap;">${etiqueta}</td>
            <td style="padding:10px 16px;${i > 0 ? 'border-top:1px solid #eceff3;' : ''}font-size:14px;color:#111827;font-weight:600;text-align:right;">${valor}</td>
          </tr>`,
      )
      .join('');

    const motivoHtml = motivoRechazo
      ? `
        <tr>
          <td colspan="2" style="padding:12px 16px;border-top:1px solid #eceff3;">
            <div style="background:#fdecec;border-radius:8px;padding:12px 14px;font-size:13px;color:#8a1f1f;">
              <strong>Motivo del rechazo:</strong> ${motivoRechazo}
            </div>
          </td>
        </tr>`
      : '';

    const botonHtml = appUrl
      ? `
        <tr>
          <td style="padding:8px 24px 28px;" align="center">
            <a href="${botonHref}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:999px;">${botonTexto}</a>
          </td>
        </tr>`
      : '';

    return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:#f2f4f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;box-shadow:0 1px 4px rgba(16,24,40,0.06);">
          <tr>
            <td style="background:${color};padding:22px 24px;">
              <span style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:0.5px;">SIGUELAB</span>
              <div style="color:#ffffff;font-size:19px;font-weight:700;margin-top:6px;line-height:1.3;">${titulo}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 24px 8px;font-size:15px;color:#374151;line-height:1.55;">${intro}</td>
          </tr>
          <tr>
            <td style="padding:8px 24px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eceff3;border-radius:12px;overflow:hidden;">
                <tr>
                  <td colspan="2" style="padding:10px 16px;background:#f7f9fc;font-size:12px;color:#6b7280;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;">${refLabel}</td>
                </tr>
                ${filasHtml}
                ${motivoHtml}
              </table>
            </td>
          </tr>
          <tr><td style="height:12px;"></td></tr>
          ${botonHtml}
          <tr>
            <td style="padding:18px 24px;background:#f7f9fc;font-size:12px;color:#9aa3af;line-height:1.5;">
              Este es un correo automático de Siguelab — Sistema de Reservas de Laboratorios. No respondas a este mensaje.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  async findMias(idUsuario: string): Promise<Notificacion[]> {
    return this.notificacionRepository.find({
      where: { idDestinatario: idUsuario },
      order: { fechaEnvio: 'DESC' },
    });
  }

  async marcarLeida(id: number, idUsuario: string): Promise<Notificacion> {
    const notificacion = await this.notificacionRepository.findOne({
      where: { idNotificacion: id },
    });
    if (!notificacion) {
      throw new HttpException(
        'Notificación no encontrada',
        HttpStatus.NOT_FOUND,
      );
    }
    if (notificacion.idDestinatario !== idUsuario) {
      throw new HttpException('No autorizado', HttpStatus.FORBIDDEN);
    }

    notificacion.estado = EstadoNotificacion.LEIDA;
    return this.notificacionRepository.save(notificacion);
  }
}
