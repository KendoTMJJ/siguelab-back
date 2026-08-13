/**
 * jwks-rsa depende de "jose", que se publica solo como ESM y Jest (con
 * ts-jest/CommonJS) no puede parsear directo desde node_modules. Los e2e
 * de este repo no necesitan validar un token real de Entra (eso se
 * verifica manualmente) — solo que las rutas protegidas rechacen
 * solicitudes sin token o con uno inválido, lo cual pasa igual con un
 * "secretOrKeyProvider" que siempre falla.
 */
export function passportJwtSecret() {
  return (
    _request: unknown,
    _rawJwtToken: unknown,
    done: (err: Error | null, secret?: string) => void,
  ) => {
    done(new Error('jwks-rsa mock: sin llave disponible en tests'));
  };
}
