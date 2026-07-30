/**
 * Envoltorio uniforme para cualquier listado paginado del API. `data` es la
 * página actual; `meta` trae lo necesario para que el cliente pinte
 * anterior/siguiente sin tener que adivinar (total, totalPages).
 */
export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
