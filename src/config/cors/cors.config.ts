import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export const corsConfig: CorsOptions = {
  origin: String(process.env.FRONTEND_URL),
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // Sin esto el navegador oculta este header en respuestas cross-origin
  // (:4200 -> :3000) — necesario para que el front lea el nombre real del
  // archivo al descargar (ver ReportesService.descargarAsistenciasLaboratorios).
  exposedHeaders: ['Content-Disposition'],
  // Sin cookies: la identidad viaja por header Authorization (token de
  // Entra), no hay nada que el navegador necesite enviar con credenciales.
  credentials: false,
};
