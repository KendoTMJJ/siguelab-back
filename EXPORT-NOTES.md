# EXPORT-NOTES — Excel "ASISTENCIAS_EN_LABS" para Power BI

Decisiones tomadas al implementar (después de `GAP-REPORT.md`), qué se sembró/migró, y
checklist manual para validar el primer archivo real contra Power BI. El usuario
autorizó explícitamente modificar seeds/catálogos donde hiciera falta ("implementa lo
necesario para hacerlo funcionar, si es necesario modificar las semillas hazlo") — las
decisiones de abajo se tomaron con ese mandato, evitando en todo momento inventar datos
que no se me dieron (ver cada punto).

## Qué se implementó

- `GET /reportes/asistencias-laboratorios/exportar` — descarga el `.xlsx`. Filtros
  opcionales `idPeriodo`, `fechaDesde`, `fechaHasta`. Sin filtros: usa el periodo activo
  (fecha_inicio ≤ hoy ≤ fecha_fin) o, si ninguno está vigente, el más reciente.
- `GET /reportes/asistencias-laboratorios/exportar/validar` — el mismo cálculo, sin
  generar el archivo; devuelve `{ totalRegistros, totalProblemas, problemas[] }`.
- Roles: `admin` y `laboratorista` (mismo patrón `@Roles(...)` que el resto del sistema
  — instrucción explícita del usuario de seguir "lo que ya teníamos implementado de los
  roles").
- Verificado en vivo contra Docker: login, `/validar` (detectó correctamente el registro
  de bitácora sin solicitud y el tipo "Semillero" fuera de lista) y la descarga real del
  `.xlsx` (headers `Content-Type`/`Content-Disposition` correctos, archivo válido según
  `file`).

## Decisiones sobre las 8 preguntas abiertas del GAP-REPORT

1. **Catálogo de laboratorios (35 salas)** — se reemplazó el seed de 11 labs genéricos
   por las 35 salas reales listadas en el prompt original (`laboratorios.seed.ts`). El
   mapeo sala→hoja vive en `src/reportes/constantes/asistencias-excel.constants.ts`
   (`LABORATORIO_A_HOJA`), no en el catálogo mismo — así ningún otro módulo del sistema
   conoce esta manía de un archivo externo.

   **Asignaciones inferidas** (el mensaje original no especificó a qué hoja
   pertenecían — se ubicaron por afinidad de nombre, marcadas `[inferido]` en el código;
   verificar contra el archivo real):
   - `MOTORES` → LAB MECANICA (la lista Q del mensaje la incluye entre las 35, pero el
     desglose por hoja de LAB MECANICA no la mencionaba explícitamente).
   - `SALA DE SEMILLERO 1/2 MATERIALES` → LAB MATERIALES Y ESTRUCTURAS.
   - `MODULO INVESTIGACIÓN PAVIMENTO` → PAVIMENTOS.
   - `MÓDULO DE INVESTIGACIÓN FÍSICA DE MATERIALES` → LAB FISICA.
   - `MÓDULO DE INVESTIGACIÓN ORGÁNICA` → LAB QUIMICA Y BIOLOGIA.
   - `FABRICACIÓN DIGITAL` → LAB ELECTRONICA (la más incierta de todas — no hay pista de
     nombre tan clara como las anteriores).

   Cualquier laboratorio en la BD que no aparezca en `LABORATORIO_A_HOJA` (ej. si algún
   día se reintroduce alguno de los 11 labs genéricos anteriores) **no se ubica a
   ciegas**: sus registros de bitácora quedan fuera del Excel y aparecen en
   `/exportar/validar` como `laboratorio_sin_hoja`.

2. **`Docente = "Estudiantes"`** — se aplica solo cuando `tipo_reserva.nombre` es
   `Investigación / Tesis` o `Semillero` (`TIPOS_DOCENTE_ES_ESTUDIANTES`); el resto
   exporta el nombre real del docente encargado. Verificado con test (
   `reportes.service.spec.ts`: "usa Estudiantes... aunque exista un docente encargado
   real").

3. **`Materia`** — se usa `solicitud_reserva.nombre_practica` (siempre tiene valor).

4. **`Uso de Laboratorio` / `Observaciones`** — se ampliaron los seeds:
   - `tipo_reserva`: se agregaron `Marketing`, `Servicios Externos`, `Clase Cancelada`,
     `Prácticas Libres Canceladas` (los 4 que exigía la lista cerrada del Excel y no
     existían). `Semillero` (que sí existe en el sistema pero NO está en esa lista
     cerrada) se exporta tal cual — no se fuerza a ninguna otra categoría — y queda
     marcado `uso_fuera_de_lista` en la validación.
   - `registro_uso.novedad` (texto libre en el sistema) se exporta tal cual en
     "Observaciones"; si no calza con las 5 opciones cerradas, queda marcado
     `observacion_fuera_de_lista`. Vacío/null → `"Ninguno"`.

5. **`Nivel` (Pregrado/Posgrado)** — se agregó `facultad.nivel` (enum, default
   `pregrado`). **No se inventaron los 48 programas** — se marcó el nivel de las 12
   facultades ya sembradas (todas pregrado, salvo "Doctorado en Pedagogía" → posgrado
   por su propio nombre) y se agregaron, con el nombre **literal** que el propio usuario
   escribió en su mensaje original (no inventado), "Cultura Física, Deporte y
   Recreación" (pregrado) y "Maestría en Entrenamiento Deportivo y Actividad Física"
   (posgrado). El catálogo real de 48 facultades queda pendiente de carga por un admin
   vía el CRUD existente (`POST /facultades`, ya acepta `nivel`).

6. **Bitácora sin solicitud asociada** — se exporta igual, con Nivel/Division/
   Facultad/Docente/Materia vacíos, y queda marcada `sin_solicitud_asociada` en la
   validación (no se excluye del archivo: preferible no subcontar uso real de
   laboratorio a ocultar filas incompletas).

7. **Hoja `Consulta1`** — **no se genera** (opción a del GAP-REPORT). El archivo tiene
   las 14 hojas de datos con sus tablas nombradas; la hoja dinámica quedó fuera porque
   `exceljs` no soporta `PivotTable`/`PivotCache`/Data Model. **Pendiente de tu
   verificación real**: abrir el archivo generado en Excel/Power BI y confirmar que
   Power Query solo depende de las tablas nombradas (`LAB_ELECTRONICA`, etc.), no de la
   hoja `Consulta1` — si el flujo real SÍ depende de esa hoja, hay que evaluar la opción
   (b) (plantilla binaria) que planteé en el GAP-REPORT.

8. **Columna1 fantasma** (`LAB QUIMICA Y BIOLOGIA`, col. P) — no se agrega. La tabla se
   genera solo hasta la columna O.

## Otras decisiones técnicas

- **NBSP**: se aplica un único NBSP (U+00A0) final a todos los nombres de laboratorio en
  la columna J (`nombreExcelLaboratorio()`), en mayúsculas. El mensaje original mencionó
  que en el archivo real "algunos" laboratorios llevan doble NBSP o espacio normal —
  **no se pudo replicar byte a byte** sin el archivo original; si Power Query separa
  alguna categoría por esto, hay que ajustar caso por caso contra el archivo real.
- **Columnas C/D (horas)**: se escriben como fracción de día (estándar de Excel) con
  `numFmt: 'h:mm'`. **Columna E (Tiempo de Uso)**: se escribe el valor numérico
  calculado, no la fórmula `=(D-C)*24` — como pediste, esto queda **pendiente de
  verificar abriendo el archivo en Excel real y refrescando Power Query** (no se puede
  probar sin acceso a Power BI).
- **Listas auxiliares Q–W**: Q (laboratorios) y las nuevas S (División) / T (Facultad)
  salen del catálogo real de la BD en el momento del export, no de una lista
  congelada — así nunca quedan desactualizadas si un admin agrega/renombra algo. R
  (semanas), U (Nivel), V (Uso de Laboratorio) y W (Observaciones) sí son fijas, tal
  como las dio el usuario. **No se reconstruyeron las validaciones de datos (dropdowns)**
  de A/F/G/H/J/N/O contra estas listas — este archivo es una foto generada por el
  sistema, no una plantilla para captura manual, así que no hacía falta.
- **Streaming**: no se usó `ExcelJS.stream.xlsx.WorkbookWriter` — esa API no soporta
  tablas de Excel nombradas (`addTable`), que son el requisito crítico de todo este
  export. Si el volumen de filas se vuelve un problema real de rendimiento, es un
  trade-off a revisar entonces (perder streaming a cambio de tablas nombradas, o
  reconstruir las tablas de otra forma).
- **Cálculo de "Semana"**: semanas corridas de 7 días desde `periodo.fecha_inicio`, sin
  excluir festivos/receso (el sistema no modela un calendario académico con
  excepciones). Documentado y con pruebas unitarias (`calcular-semana.util.spec.ts`).

## Checklist manual pendiente (necesita Power BI/Excel real — no lo pude correr yo)

1. Descargar un `.xlsx` real (`GET /reportes/asistencias-laboratorios/exportar`) con
   datos de un periodo con filas de verdad.
2. Abrirlo en Excel de escritorio — confirmar que las 14 tablas se ven como tablas de
   Excel normales (con el desplegable de filtro en el encabezado), no como rangos
   sueltos.
3. Conectar ese archivo a Power Query (o al Power Query ya existente que apuntaba al
   archivo manual) y confirmar que reconoce las 14 tablas por nombre y carga las filas.
4. Revisar que la columna "Tiempo de Uso" quede como número decimal utilizable en
   Power BI (no como texto).
5. Revisar si Power Query en algún punto referencia la hoja `Consulta1` — si sí, avisar
   para evaluar la opción de plantilla binaria.
6. Comparar un laboratorio de la lista Q contra la columna J de su propia tabla — si
   Power Query separa categorías que deberían ser la misma, es el tema del NBSP
   (byte a byte) mencionado arriba.

## Bug encontrado y corregido: "el Excel no carga los datos de las reservas" (2026-07-27)

Reportaste que el archivo exportado salía sin datos. Comparé el archivo real que me
compartiste (`ASISTENCIAS EN LABS 2026-1.xlsx`) contra lo que genera el sistema:

- **Las 14 hojas, los 14 nombres de tabla y los 15 encabezados A–O coinciden
  exactamente** con lo implementado — no había ningún desajuste de nombres ahí.
- **La causa real**: `GET /reportes/.../exportar` sin filtros usa el rango de fechas
  del periodo académico "activo" (`resolverRango()`), y los 2 registros de bitácora
  de `demo-seed.ts` tenían fecha `2026-07-10` y `2026-07-15` — **antes** de que
  empezara el único periodo cargado ("2026-2", `fecha_inicio` `2026-07-20`). El
  filtro por fecha los excluía siempre, en cualquier exportación (aunque se
  especificara ese mismo periodo por `idPeriodo`).
- **Corregido**: se movieron esas fechas dentro del rango del periodo (`demo-seed.ts`
  + los mismos registros ya sembrados en la base actual, vía `UPDATE` directo).
  Verificado en vivo: `/validar` pasó de `totalRegistros: 0` a `2`, y el archivo
  descargado ya trae ambas filas en `LAB ELECTRONICA` con los valores correctos.
- **Riesgo real para producción** (no es un bug de código, es un cuidado operativo):
  si algún día una fecha de bitácora queda fuera del rango `fecha_inicio`/`fecha_fin`
  del periodo académico en el catálogo (`PATCH /periodos-academicos/:id`), esa fila
  desaparece silenciosamente del export para ese periodo. Vale la pena correr
  `/reportes/asistencias-laboratorios/exportar/validar` (te da `totalRegistros`) como
  chequeo rápido antes de confiar en un archivo con pocas filas.

### Hallazgo nuevo comparando contra tu archivo real: texto de "Laboratorio" no coincide históricamente

Al leer la columna J del archivo real que me compartiste, los valores históricos que
Power BI ya conoce **no siempre coinciden con el nombre que el sistema exportará**
para el mismo laboratorio:

- `Cámara de Gesell` (BD) exportará `"CÁMARA DE GESELL "` (mayúsculas + 1 NBSP), pero
  el histórico real usa `"CAMARA GESELL"` (sin tilde, sin "DE", con doble NBSP).
- Varios valores históricos llevan un espacio normal al final en vez de NBSP (ej.
  `"FÍSICA DE MATERIALES Y TERMODINÁMICA "`, `"PROCESOS Y MANUFACTURA "`), y otros
  aparecen con y sin esa variación mezclados en la misma hoja.
- No encontré en el archivo real ningún dato histórico para `Fabricación Digital` ni
  para `Módulo de Investigación en Física de Materiales` — no confirma ni descarta
  las asignaciones `[inferido]` de esos dos, solo que no hay uso registrado en el
  periodo capturado en tu archivo.

**No lo cambié** porque es una decisión de negocio, no un bug: si Power Query en el
archivo real tiene reglas/relaciones construidas sobre esos textos exactos
("CAMARA GESELL", con esa ortografía), un nombre nuevo como
`"CÁMARA DE GESELL "` puede aparecer como una categoría *nueva y separada* en vez de
continuar la serie histórica. Antes de que este export reemplace el proceso manual,
vale la pena confirmar con quien arma el modelo de Power BI si:
1. Puede renombrar/mapear la categoría antigua a la nueva (recomendado — te libera de
   tener que imitar ortografías históricas inconsistentes), o
2. Si el modelo espera continuidad literal de texto — en ese caso habría que ajustar
   `nombreExcelLaboratorio()`/`LABORATORIO_A_HOJA` en
   `src/reportes/constantes/asistencias-excel.constants.ts` caso por caso para
   igualar el texto histórico exacto (no soy yo quien deba decidir esto sin
   confirmarlo con Power BI real).

## Pendiente de tu parte (no es código)

- Cargar el catálogo real de las 35 salas si difiere de los nombres/capacidades que
  puse por defecto (todas capacidad 20, salvo módulos de investigación/semilleros en
  10) — se edita igual que cualquier laboratorio, vía `PATCH /laboratorios/:id`.
- Cargar las 48 facultades reales (con su `nivel`) vía `POST /facultades` — hoy el
  catálogo solo tiene las 14 que ya existían más las 2 que se agregaron.
- Confirmar/corregir las 6 asignaciones "[inferido]" de laboratorio→hoja del punto 1.
