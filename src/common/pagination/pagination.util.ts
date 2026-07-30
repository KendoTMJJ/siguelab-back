export const PAGINATION_DEFAULT_PAGE = 1;
export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

/**
 * Normaliza page/limit recibidos como query params (siempre strings o
 * undefined en Express). Nunca deja pasar "sin límite": si vienen ausentes o
 * inválidos, caen a los valores por defecto — la paginación no es opcional,
 * es la única forma de listar estos recursos (ver GAP-REPORT: usuarios y
 * solicitudes crecen sin límite en producción).
 */
export function resolvePagination(
  page?: string | number,
  limit?: string | number,
): PaginationParams {
  const pageNum = Math.max(
    1,
    Math.trunc(Number(page)) || PAGINATION_DEFAULT_PAGE,
  );
  const limitNum = Math.min(
    PAGINATION_MAX_LIMIT,
    Math.max(1, Math.trunc(Number(limit)) || PAGINATION_DEFAULT_LIMIT),
  );

  return {
    page: pageNum,
    limit: limitNum,
    skip: (pageNum - 1) * limitNum,
    take: limitNum,
  };
}
