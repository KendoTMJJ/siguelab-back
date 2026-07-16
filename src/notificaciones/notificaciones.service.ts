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
    const base = `Solicitud #${solicitud.idSolicitud} — ${solicitud.nombrePractica} (${solicitud.fechaPractica}, ${solicitud.horaInicio}-${solicitud.horaFin}).`;
    if (tipoEvento === TipoEventoNotificacion.SOLICITUD_RECHAZADA && motivo) {
      return `${base}\nMotivo del rechazo: ${motivo}`;
    }
    return base;
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
