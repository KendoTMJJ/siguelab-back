# GAP-REPORT — Exportación Excel "ASISTENCIAS_EN_LABS" para Power BI

> Fase 1 (análisis) del pedido. **No se ha escrito código de implementación.** Este
> documento espera tu visto bueno antes de pasar a Fase 2/3, tal como pediste.

## Resumen ejecutivo (léelo antes que el resto)

El mapeo campo-a-campo (abajo) tiene varias brechas menores y resolubles. Pero hay
**un hallazgo estructural que condiciona todo lo demás** y que no es un simple
"campo faltante": el catálogo de `laboratorio` del sistema actual **no tiene la
granularidad que exige la columna J del Excel**.

- El Excel espera **35 espacios físicos específicos** (una por sala: `TELECOMUNICACIONES`,
  `INSTRUMENTACIÓN ELECTRÓNICA`, `QUÍMICA ORGÁNICA`, `MORFOFISIOLOGÍA`, etc.),
  agrupados en 14 "áreas" (las 14 hojas de laboratorio).
- El sistema actual (seed de `laboratorios.seed.ts`) tiene **11 laboratorios**, con
  nombres MÁS GENÉRICOS (`Lab. Electrónica Digital`, `Lab. Física`, `Lab. Química`...)
  que agrupan lo que en el Excel son 2-7 salas distintas cada uno, y **cubren solo
  el área de Electrónica/Física/Química/Hidráulica/Geotecnia/Materiales** — el Excel
  además espera áreas completas que hoy no existen en el sistema en absoluto:
  Mecánica (Motores, Térmicas, Procesos y Manufactura), Pavimentos, Industrial,
  Cultura Física (Morfofisiología, Fisiología del Ejercicio), Microbiología, Análisis
  Ambientales, Ecología, Cámara Gesell.
- De las 35 salas que pide el Excel, **~27 no tienen ningún laboratorio equivalente
  hoy** en el sistema, y de las que sí tienen algo parecido, la correspondencia es
  ambigua 1-a-muchos (ej. ¿"Lab. Física" es `FÍSICA MECÁNICA Y ELÉCTRICA` o `FÍSICA
  DE MATERIALES Y TERMODINÁMICA`? ¿"Módulo de Investigación" es el de Pavimentos, el
  de Física, el de Orgánica o el de Biología — el Excel tiene 4 módulos de
  investigación distintos, el sistema tiene 1 genérico). Además `Lab. Circuitos`
  existe en el sistema pero no tiene NINGÚN lugar en la lista de 35 del Excel.

**Esto no es un problema de mapeo de campos — es que el catálogo `laboratorio`
tendría que poblarse con las 35 salas reales (reemplazando/ampliando el seed de
demo actual) antes de que el export pueda producir datos coherentes.** Es una
decisión de catálogo/datos, no de código, y te la dejo planteada en la sección de
preguntas abiertas. Sigo con el resto del análisis asumiendo que ese catálogo se
resuelve aparte.

## 1. Tabla de mapeo campo a campo (columnas A–O)

| Col | Excel | Origen en el sistema | Transformación | Estado |
|---|---|---|---|---|
| A | `Semana` | `periodo_academico.fecha_inicio` + `fecha` del registro | `floor((fecha - fecha_inicio) / 7) + 1`, tope en `num_semanas`; fuera del rango del período → `"Intersemestral"` | **Derivable, con supuesto a confirmar** (ver §3) |
| B | `Fecha` | `registro_uso.fecha` (uso real) — no `solicitud_reserva.fecha_practica` (planeada) | Formato `yyyy-mm-dd` | Directo, **pero ver §2 sobre qué tabla origen usar** |
| C | `Hora Inicio` | `registro_uso.hora_inicio_real` | Formato `h:mm` | Directo (con la salvedad de §2) |
| D | `Hora Final` | `registro_uso.hora_fin_real` | Formato `h:mm` | Directo (con la salvedad de §2) |
| E | `Tiempo de Uso` | Calculado | `(horaFin - horaInicio) en horas` — escribir como valor numérico, no fórmula (a verificar con Power Query real en Fase 2, tal como pediste) | Derivable |
| F | `Nivel` | — | — | **NO DISPONIBLE.** No existe el concepto Pregrado/Posgrado en ninguna entidad (`facultad`, `usuario`, `solicitud_reserva`) — confirmado por búsqueda en todo el backend. |
| G | `Division` | `facultad.division.nombre` (vía `solicitud_reserva.id_facultad` → `facultad.id_division` → `division.nombre`) | Directo | Directo, **pero solo si el `registro_uso` tiene `id_solicitud`** (ver §2) |
| H | `Facultad` | `facultad.nombre` (vía `solicitud_reserva.id_facultad`) | Directo | Directo (misma salvedad), **y el catálogo real hoy tiene 12 facultades sembradas, no 48** — dato a cargar, no gap de código |
| I | `Docente` | `solicitud_reserva.docenteEncargado.nombre` | Directo, siempre NOT NULL en el modelo actual | Directo (misma salvedad de §2) — **la convención `"Estudiantes"` es una pregunta abierta (§4)** |
| J | `Laboratorio ` (con espacio y NBSP) | `registro_uso.laboratorio.nombre` | Ver resumen ejecutivo — requiere catálogo granular | **Bloqueado por el hallazgo estructural** |
| K | `Número de Estudiantes` | `registro_uso.num_asistentes` (asistencia real) — no `solicitud_reserva.num_personas` (planeada) | Directo | Directo |
| L | `Materia` | Ambiguo entre `solicitud_reserva.nombre_practica` (texto libre, siempre presente) y `espacio_academico.nombre` (catálogo, solo si el tipo de reserva lo exige) | — | **Ambigüedad a resolver (§4)** |
| M | `Laboratorista` | `registro_uso.laboratorista.nombre` | Directo | Directo — **pero solo existe en `registro_uso`, no en `solicitud_reserva`** (confirma la necesidad de usar bitácora como fuente, §2) |
| N | `Uso de Laboratorio` | `registro_uso.tipoReserva.nombre` | Mapeo de valores | **Gap de catálogo**: el sistema tiene 5 tipos sembrados (`Docencia`, `Práctica libre`, `Investigación / Tesis`, `Semillero`, `CAU`) contra 8 valores que exige la lista cerrada del Excel (`Investigación - Tesis`, `Docencia`, `Prácticas Libres`, `Prácticas Libres Canceladas`, `CAU`, `Marketing`, `Servicios Externos`, `Clase Cancelada`) — ni los nombres coinciden exactamente, ni faltan/sobran los mismos: `Semillero` no está en la lista del Excel, y `Marketing`/`Servicios Externos`/`Clase Cancelada`/`Prácticas Libres Canceladas` no existen como `tipo_reserva` |
| O | `Observaciones` | `registro_uso.novedad` (varchar 60, no `observaciones` que es texto libre sin tope) | Mapeo de valores | **Gap de catálogo**: `novedad` es texto libre hoy (ejemplos en el propio código: `"Docente ausente"`, `"Clase cancelada"`), no una lista cerrada contra las 5 opciones del Excel (`Ninguno`, `Docente ausente`, `Estudiantes ausentes`, `Evento academico`, `Circunstancia no prevista`) |

## 2. Ambigüedad de fondo: ¿de qué tabla sale cada fila del Excel?

El Excel se llama "ASISTENCIAS" y tiene horas **reales** (no planeadas) y novedades
post-hoc (`Docente ausente`, `Clase cancelada`) — eso apunta a `registro_uso`
(bitácora), no a `solicitud_reserva` (la reserva/solicitud). Pero `registro_uso`:

- **No tiene** `id_docente`, `id_facultad`, ni `id_espacio` directos — esos datos
  solo existen si el registro tiene `id_solicitud` (es nullable a propósito: "hay
  usos válidos sin reserva — eventualidades, históricos migrados", según el propio
  comentario de la entidad). **Si un uso real no tiene solicitud asociada, las
  columnas Nivel, Division, Facultad, Docente y Materia quedan sin fuente posible.**
  Esto no es un bug a corregir: es información que el laboratorista nunca capturó
  para ese registro porque el modelo no la pide en `POST /bitacora` cuando no hay
  `id_solicitud`.
- Sí tiene `id_laboratorista`, `num_asistentes`, horas reales y `novedad` — que
  `solicitud_reserva` no tiene en absoluto.

Es decir: **cada fila del Excel necesita, en la práctica, `registro_uso` JOIN
`solicitud_reserva` (por `id_solicitud`)**, y los registros de bitácora sin
solicitud asociada solo podrán llenar B, C, D, E, J, K, M, N, O — nunca A (semana sí
se puede, es por fecha), F, G, H, I, L. Antes de implementar necesito que confirmes
si eso es aceptable (dejar esas columnas vacías en esas filas) o si el reporte de
validación (que sí pediste como entregable obligatorio) debe marcarlas como
incompletas y excluirlas de la exportación.

## 3. Supuesto para "Semana"

El sistema tiene `periodo_academico.fecha_inicio`/`fecha_fin`/`num_semanas`, pero
**no tiene un calendario académico con festivos/semanas de receso excluidas** — es
un rango simple de fechas. El cálculo `floor((fecha - fecha_inicio)/7) + 1` asume
semanas corridas de 7 días desde el inicio del período, sin saltar festivos ni
semana de receso. Si el calendario real de la universidad tiene semanas "que no
cuentan" (ej. semana de receso a mitad de semestre), el número de semana calculado
divergirá del real a partir de ese punto. Confírmame si este supuesto es aceptable
o si hace falta modelar un calendario académico con excepciones (sería una entidad
nueva, no un simple cálculo).

## 4. Preguntas abiertas que necesito que confirmes antes de implementar

1. **Catálogo de laboratorios** (el hallazgo del resumen ejecutivo): ¿cargamos las
   35 salas reales de la universidad como laboratorios nuevos/reemplazo del seed
   actual, con su área correspondiente para saber en qué hoja va cada una? Sin esto
   no hay forma de que la columna J tenga datos correctos.
2. **`Docente = "Estudiantes"`**: ¿el sistema debe seguir esa convención (perder el
   nombre real del estudiante responsable en el Excel) o exportar el nombre real?
   Si es lo segundo, Power BI/Power Query del lado de ellos tendría que dejar de
   depender de ese valor literal — avísame si eso afecta algo río abajo.
3. **`Materia` (columna L)**: ¿`solicitud_reserva.nombre_practica` (siempre hay
   valor, texto libre tipo "Práctica de circuitos RC") o `espacio_academico.nombre`
   (catálogo controlado de materias, pero nulo para tipos que no lo exigen, como
   Práctica libre o Semillero)?
4. **`Uso de Laboratorio` y `Observaciones`**: ¿ampliamos los catálogos actuales
   (`tipo_reserva` y un nuevo campo/catálogo para `novedad`) para que calcen
   exactamente con las 8 y 5 opciones cerradas del Excel, o se acepta un mapeo
   parcial con una categoría `"Otro"` para lo que no calce?
5. **`Nivel` (Pregrado/Posgrado)**: no existe hoy. ¿Se agrega como campo nuevo en
   `facultad` (ej. columna booleana o enum), o se resuelve con una tabla de
   configuración aparte que mapee nombre-de-facultad → nivel (para no tocar el
   catálogo existente)?
6. **Registros de bitácora sin solicitud asociada** (§2): ¿se exportan con las
   columnas F/G/H/I/L vacías, o se excluyen del Excel y se listan aparte en el
   reporte de validación?
7. **Hoja `Consulta1`** (tabla dinámica): confirmo que **no es reconstruible con
   `exceljs`** — la librería no soporta `PivotTable`/`PivotCache` ni el Data Model
   de Excel. Dos caminos, como planteaste:
   - **(a)** Generar solo las 14 hojas de datos; `Consulta1` deja de generarse por
     el sistema y el archivo "maestro" que la tenía se abre y refresca a mano una
     vez (Power BI/Power Query típicamente conecta a las tablas nombradas, no a la
     hoja dinámica, así que esto no debería romper el flujo real de Power BI — pero
     lo hipotetizo, no lo he probado, por eso sigue como pregunta).
   - **(b)** Usar el `.xlsx` real como plantilla binaria, reemplazando solo las
     filas de datos de las 14 tablas y conservando el resto del paquete OOXML
     (incluida la dinámica) intacto. Es más fiel pero exige manipular el paquete
     `.xlsx` (que es un zip de XML) con cuidado quirúrgico para no invalidar las
     referencias de la tabla dinámica al rango de datos.
   Mi recomendación es empezar por **(a)** y probarlo de punta a punta contra Power
   BI real antes de invertir en (b) — pero es tu decisión, ya que dijiste
   explícitamente que no quieres que asuma. ¿Tienes acceso a probar la apertura +
   refresco en Power BI, o lo hago yo si me compartes el archivo original?
8. **`Columna1` fantasma** en `LAB QUIMICA Y BIOLOGIA` (col. P): ¿sabes si Power
   Query la referencia hoy? Si me compartes el archivo original (o el query M de
   Power Query) puedo verificarlo directamente en vez de preguntarte.

## 5. Sobre los "errores conocidos a no replicar"

De acuerdo en no reproducirlos. Notas puntuales:

- **Filas de Pavimentos fuera del rango de la tabla**: el generador, al escribir
  siempre vía `Table.addRow()`/equivalente de `exceljs` (nunca escritura directa de
  celdas sueltas), garantiza estructuralmente que esto no pase — no depende de
  disciplina humana.
- **`Edgar Gutiérrez` / `Edgar Gutierrez`, `Ciencias Básicas` / `Ciencias Básica`**:
  al salir todo de catálogos (`usuario.nombre`, `facultad.nombre`) en vez de texto
  digitado a mano, este tipo de inconsistencia ortográfica deja de ser posible por
  diseño — hay una sola fila por entidad en la base, no reintroducción manual cada
  semestre.

## Próximos pasos

Quedo a la espera de tus respuestas a la sección 4 antes de tocar código (Fase 2/3).
Si quieres, puedo arrancar en paralelo con lo que **no** depende de esas respuestas
(esqueleto del módulo, endpoint, estructura de columnas A–E/K que no tienen
ambigüedad) — dime si prefieres eso o esperar el paquete completo de decisiones.
