import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
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

const ASUNTOS: Record<TipoEventoNotificacion, string> = {
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
};

/** Frase de introducción del correo, según el evento. */
const MENSAJES: Record<TipoEventoNotificacion, string> = {
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
};

/** El color del encabezado cambia según el tono del evento (aprobado/rechazado/neutro). */
const COLOR_EVENTO: Record<TipoEventoNotificacion, string> = {
  [TipoEventoNotificacion.SOLICITUD_CREADA]: '#004f9f',
  [TipoEventoNotificacion.PENDIENTE_FIRMA]: '#004f9f',
  [TipoEventoNotificacion.FIRMA_APROBADA]: '#004f9f',
  [TipoEventoNotificacion.SOLICITUD_APROBADA]: '#0ca30c',
  [TipoEventoNotificacion.SOLICITUD_RECHAZADA]: '#d03b3b',
  [TipoEventoNotificacion.SOLICITUD_CANCELADA]: '#71717a',
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
   * Inserta una notificación por destinatario y envía el correo. Si el
   * correo falla, la fila queda `fallida` — el fallo NUNCA revienta la
   * transacción de la solicitud que la disparó (se captura y loguea).
   */
  async notificar(
    tipoEvento: TipoEventoNotificacion,
    solicitud: SolicitudReserva,
    destinatarios: DestinatarioNotificacion[],
    motivo?: string,
  ): Promise<void> {
    for (const destinatario of destinatarios) {
      const notificacion = this.notificacionRepository.create({
        idSolicitud: solicitud.idSolicitud,
        idDestinatario: destinatario.idUsuario,
        tipoEvento,
        estado: EstadoNotificacion.ENVIADA,
      });
      await this.notificacionRepository.save(notificacion);

      try {
        const cuerpo = this.construirCuerpo(tipoEvento, solicitud, motivo);
        await this.mailService.sendMail(
          destinatario.correo,
          ASUNTOS[tipoEvento],
          cuerpo,
        );
      } catch (error) {
        notificacion.estado = EstadoNotificacion.FALLIDA;
        await this.notificacionRepository.save(notificacion);
        this.logger.error(
          `Fallo al enviar notificación ${tipoEvento} a ${destinatario.correo}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  private construirCuerpo(
    tipoEvento: TipoEventoNotificacion,
    solicitud: SolicitudReserva,
    motivo?: string,
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
      solicitud.idSolicitud,
      filas,
      motivoRechazo,
    );
  }

  /**
   * Plantilla de correo con estilos EN LÍNEA y layout basado en tablas —
   * es la única forma confiable de que se vea igual en Gmail/Outlook, que
   * ignoran <style> y muchas propiedades modernas de CSS.
   */
  private plantillaHtml(
    tipoEvento: TipoEventoNotificacion,
    idSolicitud: number,
    filas: Array<{ etiqueta: string; valor: string }>,
    motivoRechazo?: string,
  ): string {
    const color = COLOR_EVENTO[tipoEvento];
    const titulo = ASUNTOS[tipoEvento];
    const intro = MENSAJES[tipoEvento];
    const appUrl = process.env.FRONTEND_URL || '';

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
            <a href="${appUrl}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:999px;">Ver en Siguelab</a>
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
                  <td colspan="2" style="padding:10px 16px;background:#f7f9fc;font-size:12px;color:#6b7280;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;">Solicitud #${idSolicitud}</td>
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
