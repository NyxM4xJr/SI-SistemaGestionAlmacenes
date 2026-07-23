# CICLO 5 — ESPECIFICACIÓN DE DIAGRAMAS (CU33, CU34, CU35, CU36, CU37, CU38)
## Especificación de Diagramas para Enterprise Architect 15
### Ciclo 5 · Proyecto SI1 · Grupo #2 · UNIVALLE

> Sigue el mismo formato usado en el Ciclo 4. Los 4 diagramas
> estándar por CU: Caso de Uso · Comunicación · Clases de Análisis ·
> Secuencia.
>
> Este documento cubre los 6 CU nuevos del Ciclo 5:
> - **CU33** — Enviar Notificación de Alertas por Email (Paquete Inventario)
> - **CU34** — Consultar Caducidad (FEFO) (Paquete Inventario)
> - **CU35** — Procesar Pago con PayPal (Paquete Autenticación y Seguridad)
> - **CU36** — Generar Órdenes de Compra Automáticas (Paquete Proveedores)
> - **CU37** — Generar Briefing Ejecutivo con IA (Paquete Reportes y Análisis)
> - **CU38** — Generar Recetas Sugeridas con IA (Paquete Menús y Recetas)
>
> Fundamentos teóricos de `<<include>>`/`<<extend>>` verificados contra
> Rumbaugh/Jacobson/Booch (*The Unified Modeling Language Reference
> Manual*) y Jacobson (*El Proceso Unificado de Desarrollo de Software*):
> `<<include>>` es comportamiento **obligatorio y factorizado** (el CU
> base queda incompleto sin él); `<<extend>>` es comportamiento
> **opcional/condicional**, insertado en un punto de extensión, y el CU
> base es completo sin él.

---

## ÍNDICE

1. Convenciones generales (idénticas a Ciclo 4 — no se repiten aquí)
2. CU33 — Enviar Notificación de Alertas por Email
3. CU34 — Consultar Caducidad (FEFO)
4. CU35 — Procesar Pago con PayPal
5. CU36 — Generar Órdenes de Compra Automáticas
6. CU37 — Generar Briefing Ejecutivo con IA
7. CU38 — Generar Recetas Sugeridas con IA
8. Tabla resumen de bitácora por CU
9. Dependencias y reutilización entre CUs del Ciclo 5
10. Actualización del Modelo Global de Casos de Uso (diagrama "Ciclo #4 (Final)")
11. Actualización del Diagrama de Análisis de Paquetes

---

# 1. CONVENCIONES GENERALES

Se reutilizan **sin cambios** las convenciones del Ciclo 4
(secciones 1.1 a 1.8: nombres de clases `C`/`CC`/`CE`, visibilidad `-`/`+`,
formato de clase, líneas continuas en Clases, tipos de mensaje en
Secuencia, fragmentos `alt`/`loop`/`critical`, separación de flujos con
Note). Una adición propia de este ciclo:

## 1.9 Convención para servicios externos de pago/IA (Resend, PayPal, OpenAI)

Ninguno de los 3 servicios externos usados en Ciclo 5 se modela como
**Entity**: no son tablas de la base de datos. Se modelan como
**auto-mensajes del Control sobre sí mismo** (`C1 → C1`), anotando entre
corchetes que es una llamada HTTP externa — **mismo criterio ya aplicado
en Ciclo 4 a la Web Speech API en CU32** (`B1 → B1: SpeechRecognition.start()`).

| Servicio | CU que lo usa | Notación del auto-mensaje |
|----------|---------------|----------------------------|
| Resend (email) | CU33, CU36 | `C1 → C1: enviarEmail(...) [HTTP POST a api.resend.com]` |
| PayPal | CU35 | `C1 → C1: crearOrden(...) [HTTP POST a api.paypal.com]` |
| OpenAI | CU37, CU38 | `C1 → C1: generarTextoIA(...) [HTTP POST a api.openai.com/v1/chat/completions]` |

En el **Diagrama de Caso de Uso**, sí se agrega como **actor secundario**
junto al actor principal (mismo criterio que CU19 con "Servicio de Mapas
OpenStreetMap"), pero no se dibuja como óvalo/entidad separada.

---

# 2. CU33 — ENVIAR NOTIFICACIÓN DE ALERTAS POR EMAIL

## 2.1 Diseño funcional adoptado (ya implementado — extraído del código real)

`notificacion_views.py::RevisarNotificarView` reutiliza dos universos de
datos ya existentes, sin tabla nueva:

1. **Alertas de stock pendientes**: `ALERTAS_STOCK` con `leida = false`
   (mismo criterio de lectura que CU13).
2. **Lotes por vencer**: `DETALLE_LOTE` con `fecha_vencimiento` dentro de
   una ventana configurable (`?dias=N`, default 7) — mismo criterio que
   CU34.
3. Si no hay alertas **ni** lotes pendientes, no se envía correo (`200`
   con `enviado: false`), sin registrar bitácora.
4. **Destinatarios**: usuarios con rol `administrador`, `gerente` o `chef`
   que tengan email cargado en `USUARIO`.
5. El cuerpo del correo se arma en texto plano en Python
   (`_construir_cuerpo()`), con dos secciones (alertas / lotes).
6. Envío vía **Resend** (API HTTP, no SMTP — Railway bloquea SMTP
   saliente), reutilizando `nucleo/resend_utils.py::enviar_email()`,
   compartida con CU36.
7. Bitácora `ENVIAR_NOTIFICACION_ALERTAS` se registra una sola vez, tras
   el intento de envío (incluye `enviados` y `fallidos`).

**No hay tabla nueva.** Solo lectura de `ALERTAS_STOCK`, `DETALLE_LOTE`,
`USUARIO`, y un INSERT en `DETALLE_BITACORA`.

## 2.2 Tabla descriptiva del caso de uso

| Campo | Detalle |
|-------|---------|
| **Caso de Uso** | CU33 — Enviar Notificación de Alertas por Email |
| **Descripción** | Permite al Administrador/Gerente revisar en un solo paso las alertas de stock pendientes y los lotes próximos a vencer, y enviar un correo resumen a los usuarios con rol administrador, gerente o chef. |
| **Propósito** | Asegurar que el personal relevante se entere de alertas y vencimientos sin depender de que alguien entre manualmente a revisar cada pantalla. |
| **Actores** | Administrador, Gerente (actor secundario: Servicio de Email Resend) |
| **Iniciador** | Administrador o Gerente |
| **Precondiciones** | El usuario ha iniciado sesión con rol administrador o gerente. Existen usuarios con rol administrador/gerente/chef con email cargado. |
| **Flujo Principal** | 1. El usuario accede a "Alertas" y presiona "Revisar y notificar por email". 2. El sistema consulta alertas de stock no leídas. 3. El sistema consulta lotes por vencer en la ventana configurada. 4. El sistema arma el cuerpo del correo. 5. El sistema envía el correo a los destinatarios vía Resend. 6. El sistema registra la acción en bitácora y confirma con un mensaje de éxito. |
| **Postcondiciones** | Los destinatarios reciben un correo resumen. Queda un registro en BITÁCORA con la acción `ENVIAR_NOTIFICACION_ALERTAS` y el detalle de enviados/fallidos. No se modifica ninguna tabla de negocio. |
| **Excepciones** | E1: Si no hay alertas ni lotes pendientes → `enviado: false`, sin enviar correo ni registrar bitácora. E2: Si ningún destinatario tiene email → error 400 "No hay destinatarios con email configurado". E3: Si Resend rechaza el envío a algún destinatario → se reporta en `fallidos`, sin bloquear el envío a los demás. |

---

## DIAGRAMA 1 — Caso de Uso

### 📋 ESPECIFICACIÓN

**Tipo:** UML Use Case Diagram
**Actores:** Administrador, Gerente (secundario: Servicio de Email Resend)
**UC principal:** UC33 — Enviar Notificación de Alertas por Email

**Sub-UCs:**

| Sub-UC | Relación | Tipo |
|--------|----------|------|
| Consultar Alertas de Stock (UC13) | `<<include>>` | Siempre se ejecuta — referencia externa a **UC13** |
| Consultar Caducidad (UC34) | `<<include>>` | Siempre se ejecuta — referencia externa a **UC34** |
| Armar Cuerpo del Correo | `<<include>>` | Siempre se ejecuta |
| Enviar Correo (Resend) | `<<include>>` | Siempre se ejecuta si hay algo pendiente |
| Registrar en Bitácora | `<<include>>` | Siempre se ejecuta tras el intento de envío |
| Personalizar Ventana de Días | `<<extend>>` | Opcional (parámetro `dias`, default 7) |

**Notación:** UC13 y UC34 se dibujan como óvalos punteados fuera del
boundary principal (referencias externas), igual criterio que CU29 con
UC25/UC26/UC27.

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Inventario` → **Add Diagram...** → `UML Behavioral` → `Use Case`
2. Name: `CU33 - Diagrama de Caso de Uso` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor** `Administrador` y `Gerente`
4. Arrastra **System Boundary** = "Sistema ODAA Simplificado"; dentro, **Use Case** para UC33 y sus sub-UCs propias
5. **Fuera** del boundary, arrastra **Use Case** UC13 y UC34 (referencias externas)
6. Conectar Actor → UC33 con **Association**
7. Conectar UC33 → sub-UCs de inclusión (incluyendo UC13/UC34) con **Include**
8. Conectar UC33 → "Personalizar Ventana de Días" con **Extend**
9. **Ctrl + S**

---

## DIAGRAMA 2 — Comunicación

### 📋 ESPECIFICACIÓN

**Tipo:** UML Communication Diagram

#### Enlaces

| Enlace | Elementos |
|--------|-----------|
| L1 | ACT ↔ B1 `:CAlertaList` |
| L2 | B1 ↔ C1 `:CCNotificacionAlertas` |
| L3 | C1 ↔ E1 `:ALERTAS_STOCK` |
| L4 | C1 ↔ E2 `:DETALLE_LOTE` |
| L5 | C1 ↔ E3 `:USUARIO` |
| L6 | C1 ↔ E4 `:DETALLE_BITACORA` |

#### Tabla de mensajes

**Flujo único — Revisar y notificar**

| N° | Enlace | Dirección | Texto del mensaje |
|----|--------|-----------|---------------------|
| 1 | L1 | ACT → B1 | `revisarYNotificar(dias?)` |
| 1.1 | L2 | B1 → C1 | `revisarNotificar(dias)` |
| 1.2 | L3 | C1 → E1 | `SELECT * FROM alertas_stock WHERE leida=false` |
| 1.3 | L3 | E1 → C1 | `List<AlertaStock>` |
| 1.4 | L4 | C1 → E2 | `SELECT * FROM detalle_lote WHERE fecha_vencimiento <= hoy+dias` |
| 1.5 | L4 | E2 → C1 | `List<DetalleLote>` |
| 1.6 | L2 | C1 → C1 | `[si no hay alertas ni lotes] retornar sin enviar` |
| 1.7 | L5 | C1 → E3 | `SELECT email FROM usuario WHERE rol IN ('administrador','gerente','chef')` |
| 1.8 | L5 | E3 → C1 | `List<email>` |
| 1.9 | L2 | C1 → C1 | `construirCuerpoCorreo(alertas, lotes)` |
| 1.10 | L2 | C1 → C1 | `enviarEmail(destinatarios, asunto, cuerpo) [HTTP POST a Resend, por cada destinatario]` |
| 1.11 | L6 | C1 → E4 | `registrarBitacora("ENVIAR_NOTIFICACION_ALERTAS", detalles)` |
| 1.12 | L2 | C1 → B1 | `mostrarResultado(enviados, fallidos)` |

#### Descripción del diagrama de comunicación

**Qué hace el CU:** Junta alertas de stock y lotes por vencer, arma un
correo resumen y lo envía a los usuarios relevantes, dejando constancia
en bitácora.

**Flujo único:** no hay pasos condicionados por el usuario (a diferencia
de CU25/CU16, no hay un "paso 2" separado): todo ocurre en una sola
llamada `POST /api/notificaciones/revisar/`.

**Particularidades técnicas:** el envío es por-destinatario (Resend no
soporta un solo request multi-destinatario sin dominio verificado), por
lo que 1.10 se repite internamente una vez por cada email — se documenta
como `loop` en el diagrama de Secuencia (no en Comunicación, que no
representa fragmentos).

**Bitácora:** se registra `ENVIAR_NOTIFICACION_ALERTAS` con el conteo de
alertas, lotes, enviados y fallidos.

**Actor Principal:** Administrador, Gerente

**Precondiciones:** Usuario autenticado con rol administrador o gerente.

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Inventario` → **Add Diagram...** → `UML Behavioral` → `Communication`
2. Name: `CU33 - Diagrama de Comunicación` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor** `Administrador`/`Gerente`
4. Toolbox → `Common` → arrastra **Class** para cada Boundary/Control/Entity → Stereotype correspondiente
5. Conectar con **Link** según la tabla de enlaces L1–L6
6. Clic derecho sobre cada Link → agregar mensajes con numeración jerárquica del flujo único (1, 1.1...1.12)
7. **Ctrl + S**

---

## DIAGRAMA 3 — Clases de Análisis

### 📋 ESPECIFICACIÓN

**Tipo:** UML Class Diagram
**Layout obligatorio:** Actor (izq.) → Boundary → Control → Entity (der.)

#### Clases

**Boundary — CAlertaList**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | dias: int |
| `-` | enviando: boolean |
| `+` | revisarYNotificar(): void |

**Control — CCNotificacionAlertas**

| Visibilidad | Miembro |
|-------------|---------|
| `+` | revisarNotificar(dias: int): ResultadoNotificacion |
| `-` | construirCuerpoCorreo(alertas: List, lotes: List): string |
| `-` | obtenerDestinatarios(): List |

**Entity — CEAlertaStock**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | mensaje: string |
| `-` | leida: boolean |
| `-` | stockId: int |

**Entity — CEDetalleLote**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | insumoId: int |
| `-` | fechaVencimiento: date |
| `-` | cantidad: decimal |

**Entity — CEUsuario**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: string |
| `-` | email: string |
| `-` | rol: string |

**Entity — CEDetalleBitacora**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | accion: string |
| `-` | detalles: json |

#### Conexiones

| Desde | Hacia | Tipo EA 15 | Mult. Desde | Mult. Hacia | Etiqueta |
|-------|-------|------------|-------------|-------------|----------|
| ACT | CAlertaList | Association (continua) | — | — | — |
| CAlertaList | CCNotificacionAlertas | Association (continua) | — | — | — |
| CCNotificacionAlertas | CEAlertaStock | Association (continua) | 1 | 0..* | consulta |
| CCNotificacionAlertas | CEDetalleLote | Association (continua) | 1 | 0..* | consulta |
| CCNotificacionAlertas | CEUsuario | Association (continua) | 1 | 1..* | resuelve destinatarios |
| CCNotificacionAlertas | CEDetalleBitacora | Association (continua) | 1 | 1 | registra |

### 🖱️ PASOS EN EA 15

1. `Inventario` → **Add Diagram...** → `UML Structural` → `Class`
2. Name: `CU33 - Diagrama de Clases (Análisis)` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor** (extremo izquierdo)
4. Toolbox → `Common` → arrastra **Class** para cada Boundary/Control/Entity → Stereotype correspondiente
5. Atributos/métodos vía **Features → Attributes/Operations**
6. Conexiones **Association** con multiplicidades
7. **Ctrl + S**

---

## DIAGRAMA 4 — Secuencia

### 📋 ESPECIFICACIÓN

**Tipo:** UML Sequence Diagram

#### Lifelines (izquierda → derecha)

| Posición | Nombre | Estereotipo |
|----------|--------|--------------|
| 1° | Administrador / Gerente | — (actor) |
| 2° | `:CAlertaList` | `boundary` |
| 3° | `:CCNotificacionAlertas` | `control` |
| 4° | `:ALERTAS_STOCK` | `entity` |
| 5° | `:DETALLE_LOTE` | `entity` |
| 6° | `:USUARIO` | `entity` |
| 7° | `:DETALLE_BITACORA` | `entity` |

#### Tabla de mensajes

**Flujo único**

| N° | Desde | Hasta | Tipo flecha | Texto del mensaje |
|----|-------|-------|-------------|---------------------|
| 1 | Actor | LL2 | Síncrono | `revisarYNotificar(dias)` |
| 1.1 | LL2 | LL3 | Síncrono | `revisarNotificar(dias)` |
| 1.2 | LL3 | LL4 | Síncrono | `SELECT * FROM alertas_stock WHERE leida=false` |
| 1.3 | LL4 | LL3 | Retorno | `List<AlertaStock>` |
| 1.4 | LL3 | LL5 | Síncrono | `SELECT * FROM detalle_lote WHERE fecha_vencimiento <= hoy+dias` |
| 1.5 | LL5 | LL3 | Retorno | `List<DetalleLote>` |
| 1.6 | LL3 | LL6 | Síncrono | `SELECT email FROM usuario WHERE rol IN (...)` |
| 1.7 | LL6 | LL3 | Retorno | `List<email>` |
| 1.8 | LL3 | LL3 | Síncrono | `construirCuerpoCorreo(alertas, lotes)` |
| 1.9 | LL3 | LL3 | Síncrono | `enviarEmail(destinatario, asunto, cuerpo) [HTTP a Resend]` |
| 1.10 | LL3 | LL7 | Asíncrono | `registrarBitacora("ENVIAR_NOTIFICACION_ALERTAS", detalles)` |
| 1.11 | LL3 | LL2 | Retorno | `ResultadoNotificacion` |
| 1.12 | LL2 | Actor | Retorno | `mostrarResultado()` |

#### Tabla de fragmentos

| Fragmento | Tipo | Guarda / Condición | Lifelines que abarca | Está dentro de |
|-----------|------|---------------------|------------------------|-----------------|
| F1 | `alt` | `[hay alertas o lotes pendientes] / [nada pendiente → retornar sin enviar]` | LL3 | Antes de 1.6 |
| F2 | `loop` | `[para cada destinatario]` | LL3 | Mensaje 1.9 |
| F3 | `critical` | *(sin guarda)* | LL3 → LL7 | Mensaje 1.10 |

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Inventario` → **Add Diagram...** → `UML Behavioral` → `Sequence`
2. Name: `CU33 - Diagrama de Secuencia` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor**
4. Toolbox → `Common` → arrastra **Class** para cada lifeline → Stereotype correspondiente
5. Mensajes según tabla (Synchronous/Return/Asynchronous)
6. Fragmentos: Toolbox → `Interaction` → arrastra **Combined Fragment** ×3 (`alt`, `loop`, `critical`)
7. **Ctrl + S**

## 2.3 Checklist final CU33

- [ ] UC33 con `<<include>>` hacia UC13, UC34, y los pasos internos; `<<extend>>` hacia "Personalizar Ventana de Días".
- [ ] Comunicación: 6 enlaces, 1 flujo único.
- [ ] Clases: `CAlertaList`, `CCNotificacionAlertas` + 4 Entity, todas con líneas continuas.
- [ ] Secuencia: 7 lifelines, fragmento `alt` (nada pendiente), `loop` (por destinatario), `critical` (bitácora).
- [ ] Bitácora: `ENVIAR_NOTIFICACION_ALERTAS`, solo si se intentó enviar.

---
# 3. CU34 — CONSULTAR CADUCIDAD (FEFO)

## 3.1 Diseño funcional adoptado

`caducidad_views.py::CaducidadListView` es de **solo lectura**:

1. Trae todo `DETALLE_LOTE`, ordenado ascendente por `fecha_vencimiento`
   (política FEFO: *First Expired, First Out*).
2. Calcula en Python el estado de cada fila: `vencido`
   (`fecha_vencimiento < hoy`), `por_vencer` (`hoy <= fecha_vencimiento <=
   hoy + dias`) o `ok`. Ventana configurable vía `?dias=` (default 7).
3. Es deliberadamente informativo: **no** rastrea consumo por lote (el
   modelo de datos no tiene cantidad restante por lote). Si el Chef
   decide descartar un lote vencido, reutiliza el endpoint ya existente
   de CU14 (`POST /movimientos/` con `tipo='merma'`) — no hay endpoint
   nuevo para eso.

**No hay tabla nueva.** Solo lectura de `DETALLE_LOTE`, `LOTE`, `INSUMO`.
Sin bitácora (mismo criterio que CU29: CU de consulta de alta frecuencia).

## 3.2 Tabla descriptiva del caso de uso

| Campo | Detalle |
|-------|---------|
| **Caso de Uso** | CU34 — Consultar Caducidad (FEFO) |
| **Descripción** | Muestra al Administrador/Chef los lotes ordenados por fecha de vencimiento (FEFO), clasificados como vencido, por vencer u ok. |
| **Propósito** | Facilitar la rotación correcta del inventario (usar primero lo que vence antes) y visibilizar mermas potenciales antes de que ocurran. |
| **Actores** | Administrador, Chef |
| **Iniciador** | Administrador o Chef |
| **Precondiciones** | Usuario autenticado con rol administrador o chef. Existen lotes registrados (CU12/CU14). |
| **Flujo Principal** | 1. El usuario accede a "Caducidad". 2. El sistema consulta todos los detalle_lote ordenados por fecha de vencimiento. 3. El sistema calcula el estado de cada uno según la ventana de días. 4. El sistema muestra la lista con badges de color por estado. 5. Opcionalmente, el usuario ajusta la ventana de días. |
| **Postcondiciones** | El usuario visualiza el estado de caducidad actualizado. No se modifica ninguna tabla (CU de solo lectura). |
| **Excepciones** | E1: Si `fecha_vencimiento` es nula o inválida en algún registro, se clasifica como `ok` por defecto sin bloquear el resto de la lista. |

---

## DIAGRAMA 1 — Caso de Uso

### 📋 ESPECIFICACIÓN

**Tipo:** UML Use Case Diagram
**Actores:** Administrador, Chef
**UC principal:** UC34 — Consultar Caducidad (FEFO)

**Sub-UCs:**

| Sub-UC | Relación | Tipo |
|--------|----------|------|
| Ordenar por Fecha de Vencimiento | `<<include>>` | Siempre se ejecuta |
| Calcular Estado (vencido/por_vencer/ok) | `<<include>>` | Siempre se ejecuta |
| Filtrar Ventana de Días | `<<extend>>` | Opcional |
| Registrar Movimiento de Merma (UC14) | `<<extend>>` | Opcional — referencia externa a **UC14**, acción posterior del Chef |

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Inventario` → **Add Diagram...** → `UML Behavioral` → `Use Case`
2. Name: `CU34 - Diagrama de Caso de Uso` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor** `Administrador`/`Chef`
4. Arrastra **System Boundary**; dentro, **Use Case** para UC34 y sus sub-UCs de include
5. **Fuera** del boundary, arrastra **Use Case** UC14 (referencia externa)
6. Conectar Actor → UC34 con **Association**
7. Conectar UC34 → sub-UCs de include con **Include**; UC34 → "Filtrar Ventana" y UC14 con **Extend**
8. **Ctrl + S**

---

## DIAGRAMA 2 — Comunicación

### 📋 ESPECIFICACIÓN

**Tipo:** UML Communication Diagram

#### Enlaces

| Enlace | Elementos |
|--------|-----------|
| L1 | ACT ↔ B1 `:CCaducidadList` |
| L2 | B1 ↔ C1 `:CCCaducidad` |
| L3 | C1 ↔ E1 `:DETALLE_LOTE` |
| L4 | C1 ↔ E2 `:LOTE` |
| L5 | C1 ↔ E3 `:INSUMO` |

#### Tabla de mensajes

| N° | Enlace | Dirección | Texto del mensaje |
|----|--------|-----------|---------------------|
| 1 | L1 | ACT → B1 | `consultarCaducidad(dias?)` |
| 1.1 | L2 | B1 → C1 | `listarCaducidad(dias)` |
| 1.2 | L3 | C1 → E1 | `SELECT * FROM detalle_lote ORDER BY fecha_vencimiento ASC` |
| 1.3 | L3 | E1 → C1 | `List<DetalleLote>` |
| 1.4 | L4 | C1 → E2 | `JOIN lote (fecha_ing) vía lote_id` |
| 1.5 | L4 | E2 → C1 | `fechaIng` |
| 1.6 | L5 | C1 → E3 | `JOIN insumo (nombre) vía insumo_id` |
| 1.7 | L5 | E3 → C1 | `nombre` |
| 1.8 | L2 | C1 → C1 | `calcularEstado(fechaVencimiento, dias)` *(por cada fila)* |
| 1.9 | L2 | C1 → B1 | `mostrarListaFEFO(items, vencidos, porVencer)` |

#### Descripción del diagrama de comunicación

**Qué hace el CU:** Lista los lotes en orden FEFO con su estado calculado,
sin modificar ninguna tabla.

**Flujo único:** consulta + cálculo, sin ramas de escritura.

**Particularidades técnicas:** el ordenamiento `ORDER BY fecha_vencimiento
ASC` es la política FEFO aplicada directamente como criterio de consulta,
no un cálculo adicional.

**Bitácora:** no se registra (CU de solo lectura, alta frecuencia de
consulta — mismo criterio que CU29).

**Actor Principal:** Administrador, Chef

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Inventario` → **Add Diagram...** → `UML Behavioral` → `Communication`
2. Name: `CU34 - Diagrama de Comunicación` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor** `Administrador`/`Chef`
4. Toolbox → `Common` → arrastra **Class** para cada Boundary/Control/Entity → Stereotype correspondiente
5. Conectar con **Link** según L1–L5
6. Mensajes jerárquicos del flujo único (1, 1.1...1.9)
7. **Ctrl + S**

---

## DIAGRAMA 3 — Clases de Análisis

### 📋 ESPECIFICACIÓN

**Tipo:** UML Class Diagram
**Layout obligatorio:** Actor (izq.) → Boundary → Control → Entity (der.)

#### Clases

**Boundary — CCaducidadList**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | dias: int |
| `-` | items: List |
| `-` | cargando: boolean |
| `+` | consultarCaducidad(): void |

**Control — CCCaducidad**

| Visibilidad | Miembro |
|-------------|---------|
| `+` | listarCaducidad(dias: int): List |
| `-` | calcularEstado(fechaVencimiento: date, dias: int): string |

**Entity — CEDetalleLote**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | loteId: int |
| `-` | insumoId: int |
| `-` | stockId: int |
| `-` | cantidad: decimal |
| `-` | costoUnitario: decimal |
| `-` | fechaVencimiento: date |

**Entity — CELote**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | fechaIng: date |

**Entity — CEInsumo**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | nombre: string |

#### Conexiones

| Desde | Hacia | Tipo EA 15 | Mult. Desde | Mult. Hacia | Etiqueta |
|-------|-------|------------|-------------|-------------|----------|
| ACT | CCaducidadList | Association (continua) | — | — | — |
| CCaducidadList | CCCaducidad | Association (continua) | — | — | — |
| CCCaducidad | CEDetalleLote | Association (continua) | 1 | 0..* | consulta |
| CEDetalleLote | CELote | Association (continua) | 1..* | 1 | pertenece a |
| CEDetalleLote | CEInsumo | Association (continua) | 1..* | 1 | pertenece a |

### 🖱️ PASOS EN EA 15

1. `Inventario` → **Add Diagram...** → `UML Structural` → `Class`
2. Name: `CU34 - Diagrama de Clases (Análisis)` → **OK**
3. Actor izquierda, Boundary/Control/Entity con **Class + Stereotype**
4. Atributos/métodos vía **Features**
5. Conexiones **Association** con multiplicidades
6. **Ctrl + S**

---

## DIAGRAMA 4 — Secuencia

### 📋 ESPECIFICACIÓN

**Tipo:** UML Sequence Diagram

#### Lifelines (izquierda → derecha)

| Posición | Nombre | Estereotipo |
|----------|--------|--------------|
| 1° | Administrador / Chef | — (actor) |
| 2° | `:CCaducidadList` | `boundary` |
| 3° | `:CCCaducidad` | `control` |
| 4° | `:DETALLE_LOTE` | `entity` |
| 5° | `:LOTE` | `entity` |
| 6° | `:INSUMO` | `entity` |

#### Tabla de mensajes

| N° | Desde | Hasta | Tipo flecha | Texto del mensaje |
|----|-------|-------|-------------|---------------------|
| 1 | Actor | LL2 | Síncrono | `consultarCaducidad(dias)` |
| 1.1 | LL2 | LL3 | Síncrono | `listarCaducidad(dias)` |
| 1.2 | LL3 | LL4 | Síncrono | `SELECT * FROM detalle_lote ORDER BY fecha_vencimiento ASC` |
| 1.3 | LL4 | LL3 | Retorno | `List<DetalleLote>` |
| 1.4 | LL3 | LL5 | Síncrono | `join lote (fecha_ing)` |
| 1.5 | LL5 | LL3 | Retorno | `fechaIng` |
| 1.6 | LL3 | LL6 | Síncrono | `join insumo (nombre)` |
| 1.7 | LL6 | LL3 | Retorno | `nombre` |
| 1.8 | LL3 | LL3 | Síncrono | `calcularEstado(fechaVencimiento, dias)` |
| 1.9 | LL3 | LL2 | Retorno | `List<ItemCaducidad>` |
| 1.10 | LL2 | Actor | Retorno | `mostrarListaFEFO()` |

#### Tabla de fragmentos

| Fragmento | Tipo | Guarda / Condición | Lifelines que abarca | Está dentro de |
|-----------|------|---------------------|------------------------|-----------------|
| F1 | `loop` | `[para cada detalle_lote]` | LL3, LL5, LL6 | Mensajes 1.4 a 1.8 |
| F2 | `alt` | `[fecha_vencimiento válida] / [fecha nula o inválida → estado ok por defecto]` | LL3 | Dentro de F1, en 1.8 |

> **Nota:** este CU no tiene fragmento `critical` porque no registra
> bitácora (es de solo lectura, mismo criterio que CU29).

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Inventario` → **Add Diagram...** → `UML Behavioral` → `Sequence`
2. Name: `CU34 - Diagrama de Secuencia` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor**
4. Toolbox → `Common` → arrastra **Class** por lifeline → Stereotype
5. Mensajes según tabla
6. Fragmentos: `loop` envolviendo 1.4–1.8, `alt` anidado dentro en 1.8 (arrastrar el segundo fragmento DENTRO del primero)
7. **Ctrl + S**

## 3.3 Checklist final CU34

- [ ] UC34 con `<<include>>` hacia ordenar/calcular estado; `<<extend>>` hacia filtrar ventana y hacia UC14 (referencia externa).
- [ ] Comunicación: 5 enlaces, 1 flujo único.
- [ ] Clases: `CCaducidadList`, `CCCaducidad` + 3 Entity.
- [ ] Secuencia: 6 lifelines, `loop` (por lote) con `alt` anidado (fecha válida/inválida). Sin `critical` (sin bitácora).
- [ ] Sin bitácora — documentar explícitamente el motivo en el informe técnico (igual criterio que CU29).

---
# 4. CU35 — PROCESAR PAGO CON PAYPAL

> CU con **2 flujos** (crear/capturar automático, y aprobación manual
> fallback), mismo patrón que CU16 del Ciclo 4.

## 4.1 Diseño funcional adoptado

**Decisión 1 — Dos boundaries, un control:** el flujo normal (crear +
capturar orden) vive en `PagoDeposito.tsx`; el flujo de fallback (aprobar/
rechazar manual, consultar estado) vive en `HistorialPagos.tsx`. Ambos
llaman al mismo backend (`pago_views.py`).

**Decisión 2 — Por qué existe el fallback manual:** el sandbox de PayPal
no siempre disparó el webhook `CHECKOUT.ORDER.APPROVED` durante las
pruebas. Sin el fallback, un pago capturado en PayPal podía quedar sin
reflejarse nunca en `pagos_sistema`. La aprobación manual exige rol
administrador y deja registro en bitácora igual que el flujo automático.

**Decisión 3 — Diagnóstico de solo lectura:** `EstadoOrdenPayPalView`
consulta el estado real de una orden en PayPal sin modificar nada, para
que el administrador decida si aprobar/rechazar manualmente tiene sentido.

**Reutilización:** `HistorialPagosView`/`SaldoPagosView` son compartidas
con CU31 (Stripe) — no se duplican para PayPal.

## 4.2 Tabla descriptiva del caso de uso

| Campo | Detalle |
|-------|---------|
| **Caso de Uso** | CU35 — Procesar Pago con PayPal |
| **Descripción** | Permite al Administrador depositar fondos usando PayPal como segunda pasarela de pago (junto a Stripe, CU31), con aprobación manual como respaldo si el webhook de PayPal no confirma el pago automáticamente. |
| **Propósito** | Ofrecer una alternativa de pago a Stripe, con una red de seguridad ante la baja confiabilidad observada del webhook de PayPal en modo sandbox. |
| **Actores** | Administrador (actor secundario: PayPal) |
| **Iniciador** | Administrador |
| **Precondiciones** | Usuario autenticado con rol administrador. Credenciales de PayPal (`PAYPAL_CLIENT_ID`/`SECRET`) configuradas. |
| **Flujo Principal** | 1. El administrador ingresa un monto en "Depositar Fondos" y elige PayPal. 2. El sistema crea la orden en PayPal y redirige al checkout. 3. El administrador aprueba el pago en PayPal. 4. El sistema captura el pago aprobado. 5. El webhook de PayPal confirma la captura (o no). 6. El sistema registra la acción en bitácora. |
| **Flujo Alternativo (fallback)** | 5a. Si el webhook no confirma en un tiempo razonable, el administrador entra a "Historial de Pagos", revisa el estado real de la orden (diagnóstico) y aprueba o rechaza el pago manualmente. |
| **Postcondiciones** | Se crea/actualiza un registro en `PAGOS_SISTEMA` con el estado final del pago. Se registra la acción en bitácora (automática o manual). |
| **Excepciones** | E1: Si PayPal rechaza la creación de la orden → error mostrado al administrador, sin registrar el pago. E2: Si la captura falla (`422 ORDER_NOT_APPROVED`) → mensaje claro indicando que el pago no fue aprobado en PayPal. E3: Si el webhook llega sin firma válida (`PAYPAL_WEBHOOK_ID` no configurado) → se procesa igual pero sin verificar firma, solo para no bloquear desarrollo local. |

---

## DIAGRAMA 1 — Caso de Uso

### 📋 ESPECIFICACIÓN

**Tipo:** UML Use Case Diagram
**Actores:** Administrador (secundario: PayPal)
**UC principal:** UC36 — Procesar Pago con PayPal

**Sub-UCs:**

| Sub-UC | Relación | Tipo |
|--------|----------|------|
| Crear Orden en PayPal | `<<include>>` | Siempre se ejecuta |
| Capturar Pago Aprobado | `<<include>>` | Siempre se ejecuta |
| Registrar en Bitácora | `<<include>>` | Siempre se ejecuta |
| Consultar Estado de la Orden | `<<extend>>` | Opcional (diagnóstico) |
| Aprobar Pago Manualmente | `<<extend>>` | Opcional — solo si el webhook no confirma |
| Rechazar Pago Manualmente | `<<extend>>` | Opcional — solo si el webhook no confirma |

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Autenticación y Seguridad` → **Add Diagram...** → `UML Behavioral` → `Use Case`
2. Name: `CU35 - Diagrama de Caso de Uso` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor** `Administrador`
4. Arrastra un segundo **Actor** `PayPal` (secundario, fuera del boundary)
5. Arrastra **System Boundary**; dentro, **Use Case** para UC36 y sus sub-UCs de include
6. Conectar Actor Administrador → UC36 con **Association**; Actor PayPal → "Crear Orden"/"Capturar Pago" con **Association**
7. Conectar UC36 → sub-UCs de include con **Include**; UC36 → las 3 extend con **Extend**
8. **Ctrl + S**

---

## DIAGRAMA 2 — Comunicación

### 📋 ESPECIFICACIÓN

**Tipo:** UML Communication Diagram

#### Enlaces

| Enlace | Elementos |
|--------|-----------|
| L1 | ACT ↔ B1 `:CPagoDeposito` |
| L2 | ACT ↔ B2 `:CHistorialPagos` |
| L3 | B1 ↔ C1 `:CCPagoPayPal` |
| L4 | B2 ↔ C1 |
| L5 | C1 ↔ E1 `:PAGOS_SISTEMA` |
| L6 | C1 ↔ E2 `:DETALLE_BITACORA` |

#### Tabla de mensajes

**Flujo 1 — Crear y capturar orden (automático)**

| N° | Enlace | Dirección | Texto del mensaje |
|----|--------|-----------|---------------------|
| 1 | L1 | ACT → B1 | `depositarConPayPal(monto)` |
| 1.1 | L3 | B1 → C1 | `crearOrdenPayPal(monto)` |
| 1.2 | L3 | C1 → C1 | `crearOrden(monto) [HTTP POST a PayPal API]` |
| 1.3 | L5 | C1 → E1 | `INSERT INTO pagos_sistema (paypal_order_id, estado='pendiente', monto)` |
| 1.4 | L5 | E1 → C1 | `pagoCreado` |
| 1.5 | L3 | C1 → B1 | `redirigirCheckout(approveUrl)` |
| 2 | L1 | ACT → B1 | `capturarPago(orderId)` *(tras aprobar en PayPal)* |
| 2.1 | L3 | B1 → C1 | `capturarPayPal(orderId)` |
| 2.2 | L3 | C1 → C1 | `capturarOrden(orderId) [HTTP POST a PayPal API]` |
| 2.3 | L5 | C1 → E1 | `UPDATE pagos_sistema SET estado='completado' WHERE paypal_order_id=orderId` |
| 2.4 | L6 | C1 → E2 | `registrarBitacora("CAPTURAR_PAGO_PAYPAL", detalles)` |
| 2.5 | L3 | C1 → B1 | `mostrarResultado(exito)` |

**Flujo 2 — Aprobación manual (fallback)**

| N° | Enlace | Dirección | Texto del mensaje |
|----|--------|-----------|---------------------|
| 3 | L2 | ACT → B2 | `aprobarPagoManual(pagoId)` |
| 3.1 | L4 | B2 → C1 | `aprobarPagoManual(pagoId)` |
| 3.2 | L5 | C1 → E1 | `UPDATE pagos_sistema SET estado='completado' WHERE id=pagoId` |
| 3.3 | L6 | C1 → E2 | `registrarBitacora("APROBAR_PAGO_MANUAL", detalles)` |
| 3.4 | L4 | C1 → B2 | `mostrarConfirmacion()` |

#### Descripción del diagrama de comunicación

**Qué hace el CU:** Crea y captura un pago con PayPal, con una vía manual
de respaldo cuando el webhook del sandbox no confirma automáticamente.

**Flujo 1 — Automático:** crear orden → checkout externo → capturar →
actualizar estado → bitácora.

**Flujo 2 — Manual (fallback):** el administrador, desde Historial de
Pagos, fuerza el estado a `completado` (o `rechazado`) sin depender del
webhook, dejando registro igual.

**Particularidades técnicas:** ambos flujos comparten el mismo Control y
la misma Entity — solo cambia el Boundary de origen y si la actualización
de estado pasa por PayPal o es forzada por un humano.

**Bitácora:** `CAPTURAR_PAGO_PAYPAL` (Flujo 1) o `APROBAR_PAGO_MANUAL` /
`RECHAZAR_PAGO_MANUAL` (Flujo 2).

**Actor Principal:** Administrador (secundario: PayPal)

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Autenticación y Seguridad` → **Add Diagram...** → `UML Behavioral` → `Communication`
2. Name: `CU35 - Diagrama de Comunicación` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor** `Administrador`
4. Toolbox → `Common` → arrastra **Class** para `CPagoDeposito`, `CHistorialPagos`, `CCPagoPayPal`, `PAGOS_SISTEMA`, `DETALLE_BITACORA` → Stereotype
5. Conectar con **Link** según L1–L6
6. Mensajes jerárquicos: Flujo 1 (1, 1.1...2.5), Flujo 2 (3, 3.1...3.4)
7. **Ctrl + S**

---

## DIAGRAMA 3 — Clases de Análisis

### 📋 ESPECIFICACIÓN

**Tipo:** UML Class Diagram
**Layout obligatorio:** Actor (izq.) → Boundary → Control → Entity (der.)

#### Clases

**Boundary — CPagoDeposito**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | monto: decimal |
| `-` | procesando: boolean |
| `+` | crearOrdenPayPal(): void |
| `+` | capturarPayPal(): void |

**Boundary — CHistorialPagos**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | pagos: List |
| `+` | aprobarPagoManual(pagoId: int): void |
| `+` | rechazarPagoManual(pagoId: int, motivo: string): void |
| `+` | consultarEstadoOrden(orderId: string): void |

**Control — CCPagoPayPal**

| Visibilidad | Miembro |
|-------------|---------|
| `+` | crearOrdenPayPal(monto: decimal): OrdenPayPal |
| `+` | capturarPayPal(orderId: string): ResultadoPago |
| `+` | consultarEstadoOrden(orderId: string): EstadoOrden |
| `+` | aprobarPagoManual(pagoId: int): void |
| `+` | rechazarPagoManual(pagoId: int, motivo: string): void |

**Entity — CEPagoSistema**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | paypalOrderId: string |
| `-` | estado: string |
| `-` | monto: decimal |
| `-` | metodo: string |

**Entity — CEDetalleBitacora**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | accion: string |
| `-` | detalles: json |

#### Conexiones

| Desde | Hacia | Tipo EA 15 | Mult. Desde | Mult. Hacia | Etiqueta |
|-------|-------|------------|-------------|-------------|----------|
| ACT | CPagoDeposito | Association (continua) | — | — | — |
| ACT | CHistorialPagos | Association (continua) | — | — | — |
| CPagoDeposito | CCPagoPayPal | Association (continua) | — | — | — |
| CHistorialPagos | CCPagoPayPal | Association (continua) | — | — | — |
| CCPagoPayPal | CEPagoSistema | Association (continua) | 1 | 1..* | crea/actualiza |
| CCPagoPayPal | CEDetalleBitacora | Association (continua) | 1 | 1 | registra |

### 🖱️ PASOS EN EA 15

1. `Autenticación y Seguridad` → **Add Diagram...** → `UML Structural` → `Class`
2. Name: `CU35 - Diagrama de Clases (Análisis)` → **OK**
3. Actor izquierda, 2 Boundary compartiendo el mismo Control, 2 Entity
4. Atributos/métodos vía **Features**
5. Conexiones **Association**
6. **Ctrl + S**

---

## DIAGRAMA 4 — Secuencia

### 📋 ESPECIFICACIÓN

**Tipo:** UML Sequence Diagram

#### Lifelines (izquierda → derecha)

| Posición | Nombre | Estereotipo |
|----------|--------|--------------|
| 1° | Administrador | — (actor) |
| 2° | `:CPagoDeposito` | `boundary` |
| 3° | `:CHistorialPagos` | `boundary` |
| 4° | `:CCPagoPayPal` | `control` |
| 5° | `:PAGOS_SISTEMA` | `entity` |
| 6° | `:DETALLE_BITACORA` | `entity` |

#### Tabla de mensajes

**Flujo 1 — Crear y capturar orden**

| N° | Desde | Hasta | Tipo flecha | Texto del mensaje |
|----|-------|-------|-------------|---------------------|
| 1 | Actor | LL2 | Síncrono | `depositarConPayPal(monto)` |
| 1.1 | LL2 | LL4 | Síncrono | `crearOrdenPayPal(monto)` |
| 1.2 | LL4 | LL4 | Síncrono | `crearOrden(monto) [HTTP a PayPal]` |
| 1.3 | LL4 | LL5 | Síncrono | `INSERT INTO pagos_sistema (...)` |
| 1.4 | LL5 | LL4 | Retorno | `pagoCreado` |
| 1.5 | LL4 | LL2 | Retorno | `approveUrl` |
| 1.6 | LL2 | Actor | Retorno | `redirigirCheckout()` |
| 2 | Actor | LL2 | Síncrono | `capturarPago(orderId)` |
| 2.1 | LL2 | LL4 | Síncrono | `capturarPayPal(orderId)` |
| 2.2 | LL4 | LL4 | Síncrono | `capturarOrden(orderId) [HTTP a PayPal]` |
| 2.3 | LL4 | LL5 | Síncrono | `UPDATE pagos_sistema SET estado='completado'` |
| 2.4 | LL4 | LL6 | Asíncrono | `registrarBitacora("CAPTURAR_PAGO_PAYPAL", detalles)` |
| 2.5 | LL4 | LL2 | Retorno | `ResultadoPago` |
| 2.6 | LL2 | Actor | Retorno | `mostrarResultado()` |

**Flujo 2 — Aprobación manual (fallback)**

| N° | Desde | Hasta | Tipo flecha | Texto del mensaje |
|----|-------|-------|-------------|---------------------|
| 3 | Actor | LL3 | Síncrono | `aprobarPagoManual(pagoId)` |
| 3.1 | LL3 | LL4 | Síncrono | `aprobarPagoManual(pagoId)` |
| 3.2 | LL4 | LL5 | Síncrono | `UPDATE pagos_sistema SET estado='completado' WHERE id=pagoId` |
| 3.3 | LL4 | LL6 | Asíncrono | `registrarBitacora("APROBAR_PAGO_MANUAL", detalles)` |
| 3.4 | LL4 | LL3 | Retorno | `void` |
| 3.5 | LL3 | Actor | Retorno | `mostrarConfirmacion()` |

#### Tabla de fragmentos

| Fragmento | Tipo | Guarda / Condición | Lifelines que abarca | Está dentro de |
|-----------|------|---------------------|------------------------|-----------------|
| F1 | `alt` | `[PayPal aprueba y captura correctamente] / [rechaza la captura (422 ORDER_NOT_APPROVED)]` | LL4 | Flujo 1, mensaje 2.2 |
| F2 | `critical` | *(sin guarda)* | LL4 → LL6 | Flujo 1, mensaje 2.4 |
| F3 | `alt` | `[webhook confirmó automáticamente → Flujo 2 no se ejecuta] / [webhook no confirmó → Administrador usa Flujo 2]` | LL2, LL3 | Envuelve la decisión entre Flujo 1 y Flujo 2 |
| F4 | `critical` | *(sin guarda)* | LL4 → LL6 | Flujo 2, mensaje 3.3 |

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Autenticación y Seguridad` → **Add Diagram...** → `UML Behavioral` → `Sequence`
2. Name: `CU35 - Diagrama de Secuencia` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor**
4. Toolbox → `Common` → arrastra **Class** por lifeline → Stereotype
5. Mensajes según tabla, separando Flujo 1 y Flujo 2 con una **Note**
6. Fragmentos: `alt` (captura), `critical` ×2 (bitácora en cada flujo), `alt` (decisión automático/manual)
7. **Ctrl + S**

## 4.3 Checklist final CU35

- [ ] UC36 con `<<include>>` hacia crear/capturar/bitácora; `<<extend>>` hacia consultar estado, aprobar y rechazar manual.
- [ ] Comunicación: 6 enlaces, 2 flujos (automático / manual), mismo Control y Entity compartidos.
- [ ] Clases: `CPagoDeposito`, `CHistorialPagos`, `CCPagoPayPal` + 2 Entity.
- [ ] Secuencia: 6 lifelines, `alt` (captura exitosa/rechazada), `critical` ×2, `alt` (automático vs. manual).
- [ ] Documentar explícitamente por qué existe el fallback manual (confiabilidad del sandbox de PayPal).
- [ ] Bitácora: `CAPTURAR_PAGO_PAYPAL` (Flujo 1) y `APROBAR_PAGO_MANUAL`/`RECHAZAR_PAGO_MANUAL` (Flujo 2).

---
# 5. CU36 — GENERAR ÓRDENES DE COMPRA AUTOMÁTICAS

## 5.1 Diseño funcional adoptado

1. **Detección**: `STOCK` con `cantidad <= stock_min` (comparación
   columna-columna resuelta en Python, no en SQL).
2. **Selección de proveedor**: por cada insumo detectado, se consulta
   `PROVEEDOR_INSUMO` y se elige el de **menor precio**.
3. **Cantidad a pedir**: `stock_max − cantidad_actual` si `stock_max` está
   definido y es mayor a la cantidad actual; si no, una cantidad por
   defecto (`CANTIDAD_DEFAULT = 10`).
4. **Agrupación**: los insumos se agrupan por proveedor elegido — una
   orden de compra por proveedor, con varios ítems en `DETALLE_ORDEN_COMPRA`.
5. **Notificación**: correo HTML (con diseño) + texto plano de respaldo,
   vía Resend, a cada proveedor con email configurado. Si el envío tiene
   éxito, la orden pasa a estado `enviada`.
6. **Flujo alternativo — Orden manual**: `POST /api/ordenes-compra/`
   permite crear una orden sin pasar por la detección automática
   (`generada_auto=false`).
7. **Flujo alternativo — Marcar recibida**: `PATCH
   /api/ordenes-compra/{id}/` cambia el estado a `recibida` (u otro de
   `ESTADOS_VALIDOS`).

**No hay tabla nueva** más allá de `ORDEN_COMPRA` y `DETALLE_ORDEN_COMPRA`,
ya creadas en el esquema de Ciclo 5.

## 5.2 Tabla descriptiva del caso de uso

| Campo | Detalle |
|-------|---------|
| **Caso de Uso** | CU36 — Generar Órdenes de Compra Automáticas |
| **Descripción** | Detecta insumos en o por debajo del stock mínimo, elige el proveedor más barato para cada uno, agrupa en órdenes por proveedor y las notifica por correo. Permite también crear órdenes manuales y marcar órdenes como recibidas. |
| **Propósito** | Reducir el trabajo manual de reabastecimiento y asegurar que siempre se elija el proveedor más económico disponible para cada insumo. |
| **Actores** | Administrador, Gerente (actor secundario: Servicio de Email Resend) |
| **Iniciador** | Administrador o Gerente |
| **Precondiciones** | Usuario autenticado con rol administrador o gerente. Existen insumos con stock bajo mínimo y proveedores asociados (CU17/CU18) con precio cargado. |
| **Flujo Principal** | 1. El usuario presiona "Generar automáticas". 2. El sistema detecta insumos bajo mínimo. 3. El sistema elige, por insumo, el proveedor de menor precio. 4. El sistema calcula la cantidad a pedir. 5. El sistema agrupa por proveedor y crea las órdenes. 6. El sistema notifica por email a cada proveedor. 7. El sistema registra la acción en bitácora. |
| **Flujo Alternativo** | A1. El usuario crea una orden manual eligiendo proveedor e ítems directamente. A2. El usuario marca una orden existente como recibida. |
| **Postcondiciones** | Se crean filas en `ORDEN_COMPRA` y `DETALLE_ORDEN_COMPRA`. Los proveedores con email reciben la notificación. Se registra la acción en bitácora. |
| **Excepciones** | E1: Si no hay insumos bajo mínimo → `mensaje: "No hay insumos en o por debajo del stock mínimo"`, sin crear órdenes. E2: Si un insumo bajo mínimo no tiene proveedor asociado → se reporta en `insumos_sin_proveedor`, sin bloquear las demás órdenes. E3: Si Resend falla al notificar a un proveedor → la orden queda en estado `generada` (no `enviada`), sin bloquear las demás. |

---

## DIAGRAMA 1 — Caso de Uso

### 📋 ESPECIFICACIÓN

**Tipo:** UML Use Case Diagram
**Actores:** Administrador, Gerente (secundario: Servicio de Email Resend)
**UC principal:** UC37 — Generar Órdenes de Compra Automáticas

**Sub-UCs:**

| Sub-UC | Relación | Tipo |
|--------|----------|------|
| Detectar Insumos Bajo Stock Mínimo | `<<include>>` | Siempre se ejecuta |
| Seleccionar Proveedor de Menor Precio | `<<include>>` | Siempre se ejecuta |
| Calcular Cantidad a Pedir | `<<include>>` | Siempre se ejecuta |
| Notificar al Proveedor (Resend) | `<<include>>` | Siempre se intenta si el proveedor tiene email |
| Registrar en Bitácora | `<<include>>` | Siempre se ejecuta |
| Crear Orden Manual | `<<extend>>` | Opcional — entrada alternativa, sin detección automática |
| Marcar Orden como Recibida | `<<extend>>` | Opcional — acción posterior sobre una orden ya creada |

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Proveedores` → **Add Diagram...** → `UML Behavioral` → `Use Case`
2. Name: `CU36 - Diagrama de Caso de Uso` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor** `Administrador`/`Gerente`
4. Arrastra un segundo **Actor** `Resend` (secundario)
5. Arrastra **System Boundary**; dentro, **Use Case** para UC37 y sus sub-UCs de include
6. Conectar Actor → UC37 con **Association**; Resend → "Notificar al Proveedor" con **Association**
7. Conectar UC37 → sub-UCs de include con **Include**; UC37 → "Crear Orden Manual"/"Marcar como Recibida" con **Extend**
8. **Ctrl + S**

---

## DIAGRAMA 2 — Comunicación

### 📋 ESPECIFICACIÓN

**Tipo:** UML Communication Diagram

#### Enlaces

| Enlace | Elementos |
|--------|-----------|
| L1 | ACT ↔ B1 `:COrdenCompraList` |
| L2 | B1 ↔ C1 `:CCOrdenCompra` |
| L3 | C1 ↔ E1 `:STOCK` |
| L4 | C1 ↔ E2 `:PROVEEDOR_INSUMO` |
| L5 | C1 ↔ E3 `:PROVEEDOR` |
| L6 | C1 ↔ E4 `:ORDEN_COMPRA` |
| L7 | C1 ↔ E5 `:DETALLE_ORDEN_COMPRA` |
| L8 | C1 ↔ E6 `:DETALLE_BITACORA` |

#### Tabla de mensajes

**Flujo 1 — Generar automáticas**

| N° | Enlace | Dirección | Texto del mensaje |
|----|--------|-----------|---------------------|
| 1 | L1 | ACT → B1 | `generarAutomaticas()` |
| 1.1 | L2 | B1 → C1 | `generarOrdenesAutomaticas()` |
| 1.2 | L3 | C1 → E1 | `SELECT * FROM stock WHERE cantidad <= stock_min` |
| 1.3 | L3 | E1 → C1 | `List<insumo bajo mínimo>` |
| 1.4 | L4 | C1 → E2 | `SELECT * FROM proveedor_insumo WHERE insumo_id IN (...)` |
| 1.5 | L4 | E2 → C1 | `List<ProveedorInsumo>` |
| 1.6 | L2 | C1 → C1 | `seleccionarProveedorMasBarato()` *(por insumo)* |
| 1.7 | L2 | C1 → C1 | `calcularCantidadAPedir(stockMax, cantidadActual)` *(por insumo)* |
| 1.8 | L6 | C1 → E4 | `INSERT INTO orden_compra (proveedor_id, generada_auto=true)` *(por proveedor)* |
| 1.9 | L7 | C1 → E5 | `INSERT INTO detalle_orden_compra (...)` |
| 1.10 | L2 | C1 → C1 | `enviarEmail(proveedorEmail, cuerpoHtml, cuerpoTexto) [HTTP a Resend]` |
| 1.11 | L6 | C1 → E4 | `UPDATE orden_compra SET estado='enviada' WHERE email_enviado` |
| 1.12 | L8 | C1 → E6 | `registrarBitacora("GENERAR_ORDENES_COMPRA_AUTO", detalles)` |
| 1.13 | L2 | C1 → B1 | `mostrarResultado(ordenesCreadas, insumosSinProveedor)` |

**Flujo 2 — Crear orden manual**

| N° | Enlace | Dirección | Texto del mensaje |
|----|--------|-----------|---------------------|
| 2 | L1 | ACT → B1 | `crearOrdenManual(proveedorId, items)` |
| 2.1 | L2 | B1 → C1 | `crearOrden(proveedorId, items)` |
| 2.2 | L6 | C1 → E4 | `INSERT INTO orden_compra (proveedor_id, generada_auto=false)` |
| 2.3 | L7 | C1 → E5 | `INSERT INTO detalle_orden_compra (...)` |
| 2.4 | L8 | C1 → E6 | `registrarBitacora("CREAR_ORDEN_COMPRA", detalles)` |
| 2.5 | L2 | C1 → B1 | `mostrarOrdenCreada()` |

**Flujo 3 — Marcar como recibida**

| N° | Enlace | Dirección | Texto del mensaje |
|----|--------|-----------|---------------------|
| 3 | L1 | ACT → B1 | `marcarRecibida(ordenId)` |
| 3.1 | L2 | B1 → C1 | `actualizarEstado(ordenId, 'recibida')` |
| 3.2 | L6 | C1 → E4 | `UPDATE orden_compra SET estado='recibida' WHERE id=ordenId` |
| 3.3 | L8 | C1 → E6 | `registrarBitacora("ACTUALIZAR_ORDEN_COMPRA", detalles)` |
| 3.4 | L2 | C1 → B1 | `mostrarConfirmacion()` |

#### Descripción del diagrama de comunicación

**Qué hace el CU:** Automatiza la detección de insumos bajo mínimo, la
elección del proveedor más barato y la creación/notificación de órdenes
de compra, permitiendo también flujos manuales de creación y actualización.

**Particularidades técnicas:** el mismo Control (`CCOrdenCompra`) atiende
los 3 flujos; solo el Flujo 1 involucra la lógica de detección/selección
automática y el envío por Resend.

**Bitácora:** `GENERAR_ORDENES_COMPRA_AUTO` (Flujo 1), `CREAR_ORDEN_COMPRA`
(Flujo 2), `ACTUALIZAR_ORDEN_COMPRA` (Flujo 3).

**Actor Principal:** Administrador, Gerente (secundario: Resend)

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Proveedores` → **Add Diagram...** → `UML Behavioral` → `Communication`
2. Name: `CU36 - Diagrama de Comunicación` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor** `Administrador`/`Gerente`
4. Toolbox → `Common` → arrastra **Class** para cada Boundary/Control/Entity → Stereotype
5. Conectar con **Link** según L1–L8
6. Mensajes jerárquicos: Flujo 1 (1, 1.1...1.13), Flujo 2 (2, 2.1...2.5), Flujo 3 (3, 3.1...3.4)
7. **Ctrl + S**

---

## DIAGRAMA 3 — Clases de Análisis

### 📋 ESPECIFICACIÓN

**Tipo:** UML Class Diagram
**Layout obligatorio:** Actor (izq.) → Boundary → Control → Entity (der.)

#### Clases

**Boundary — COrdenCompraList**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | ordenes: List |
| `-` | generando: boolean |
| `+` | generarAutomaticas(): void |
| `+` | crearOrdenManual(): void |
| `+` | marcarRecibida(ordenId: int): void |

**Control — CCOrdenCompra**

| Visibilidad | Miembro |
|-------------|---------|
| `+` | generarOrdenesAutomaticas(): ResultadoGeneracion |
| `+` | crearOrden(proveedorId: int, items: List): OrdenCompra |
| `+` | actualizarEstado(ordenId: int, estado: string): void |
| `-` | seleccionarProveedorMasBarato(insumoId: int): ProveedorInsumo |
| `-` | calcularCantidadAPedir(stockMax: decimal, cantidadActual: decimal): int |

**Entity — CEStock**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | insumoId: int |
| `-` | cantidad: decimal |
| `-` | stockMin: decimal |
| `-` | stockMax: decimal |

**Entity — CEProveedorInsumo**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | proveedorId: int |
| `-` | insumoId: int |
| `-` | precio: decimal |

**Entity — CEProveedor**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | nombre: string |
| `-` | email: string |

**Entity — CEOrdenCompra**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | proveedorId: int |
| `-` | estado: string |
| `-` | total: decimal |
| `-` | generadaAuto: boolean |

**Entity — CEDetalleOrdenCompra**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | ordenId: int |
| `-` | insumoId: int |
| `-` | cantidad: int |
| `-` | precioUnitario: decimal |
| `-` | subtotal: decimal |

**Entity — CEDetalleBitacora**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | accion: string |
| `-` | detalles: json |

#### Conexiones

| Desde | Hacia | Tipo EA 15 | Mult. Desde | Mult. Hacia | Etiqueta |
|-------|-------|------------|-------------|-------------|----------|
| ACT | COrdenCompraList | Association (continua) | — | — | — |
| COrdenCompraList | CCOrdenCompra | Association (continua) | — | — | — |
| CCOrdenCompra | CEStock | Association (continua) | 1 | 0..* | detecta |
| CCOrdenCompra | CEProveedorInsumo | Association (continua) | 1 | 0..* | consulta precios |
| CCOrdenCompra | CEProveedor | Association (continua) | 1 | 1..* | notifica |
| CCOrdenCompra | CEOrdenCompra | Association (continua) | 1 | 0..* | crea/actualiza |
| CEOrdenCompra | CEDetalleOrdenCompra | Association (continua) | 1 | 1..* | contiene |
| CCOrdenCompra | CEDetalleBitacora | Association (continua) | 1 | 1 | registra |

### 🖱️ PASOS EN EA 15

1. `Proveedores` → **Add Diagram...** → `UML Structural` → `Class`
2. Name: `CU36 - Diagrama de Clases (Análisis)` → **OK**
3. Actor izquierda, Boundary/Control/Entity con **Class + Stereotype**
4. Atributos/métodos vía **Features**
5. Conexiones **Association** con multiplicidades
6. **Ctrl + S**

---

## DIAGRAMA 4 — Secuencia

### 📋 ESPECIFICACIÓN

**Tipo:** UML Sequence Diagram

#### Lifelines (izquierda → derecha)

| Posición | Nombre | Estereotipo |
|----------|--------|--------------|
| 1° | Administrador / Gerente | — (actor) |
| 2° | `:COrdenCompraList` | `boundary` |
| 3° | `:CCOrdenCompra` | `control` |
| 4° | `:STOCK` | `entity` |
| 5° | `:PROVEEDOR_INSUMO` | `entity` |
| 6° | `:ORDEN_COMPRA` | `entity` |
| 7° | `:DETALLE_ORDEN_COMPRA` | `entity` |
| 8° | `:DETALLE_BITACORA` | `entity` |

#### Tabla de mensajes

**Flujo 1 — Generar automáticas**

| N° | Desde | Hasta | Tipo flecha | Texto del mensaje |
|----|-------|-------|-------------|---------------------|
| 1 | Actor | LL2 | Síncrono | `generarAutomaticas()` |
| 1.1 | LL2 | LL3 | Síncrono | `generarOrdenesAutomaticas()` |
| 1.2 | LL3 | LL4 | Síncrono | `SELECT * FROM stock WHERE cantidad <= stock_min` |
| 1.3 | LL4 | LL3 | Retorno | `List<insumo bajo mínimo>` |
| 1.4 | LL3 | LL5 | Síncrono | `SELECT * FROM proveedor_insumo WHERE insumo_id IN (...)` |
| 1.5 | LL5 | LL3 | Retorno | `List<ProveedorInsumo>` |
| 1.6 | LL3 | LL3 | Síncrono | `seleccionarProveedorMasBarato()` |
| 1.7 | LL3 | LL3 | Síncrono | `calcularCantidadAPedir()` |
| 1.8 | LL3 | LL6 | Síncrono | `INSERT INTO orden_compra (...)` |
| 1.9 | LL3 | LL7 | Síncrono | `INSERT INTO detalle_orden_compra (...)` |
| 1.10 | LL3 | LL3 | Síncrono | `enviarEmail(...) [HTTP a Resend]` |
| 1.11 | LL3 | LL6 | Síncrono | `UPDATE orden_compra SET estado='enviada'` |
| 1.12 | LL3 | LL8 | Asíncrono | `registrarBitacora("GENERAR_ORDENES_COMPRA_AUTO", detalles)` |
| 1.13 | LL3 | LL2 | Retorno | `ResultadoGeneracion` |
| 1.14 | LL2 | Actor | Retorno | `mostrarResultado()` |

#### Tabla de fragmentos

| Fragmento | Tipo | Guarda / Condición | Lifelines que abarca | Está dentro de |
|-----------|------|---------------------|------------------------|-----------------|
| F1 | `alt` | `[hay insumos bajo mínimo] / [no hay → retornar sin crear órdenes]` | LL3 | Antes de 1.4 |
| F2 | `loop` | `[para cada insumo bajo mínimo]` | LL3, LL5 | Mensajes 1.4 a 1.7 |
| F3 | `loop` | `[para cada proveedor agrupado]` | LL3, LL6, LL7 | Mensajes 1.8 a 1.11 |
| F4 | `alt` | `[proveedor tiene email → notifica y marca 'enviada'] / [sin email → queda 'generada']` | LL3, LL6 | Dentro de F3, en 1.10–1.11 |
| F5 | `critical` | *(sin guarda)* | LL3 → LL8 | Mensaje 1.12 |

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Proveedores` → **Add Diagram...** → `UML Behavioral` → `Sequence`
2. Name: `CU36 - Diagrama de Secuencia` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor**
4. Toolbox → `Common` → arrastra **Class** por lifeline → Stereotype
5. Mensajes según tabla (Flujo 1 completo; Flujos 2/3 opcionalmente en el mismo diagrama con una **Note** separadora, o en diagramas aparte si EA se satura)
6. Fragmentos: `alt` (sin insumos), `loop` ×2 anidados (por insumo, por proveedor) con `alt` anidado dentro (email sí/no), `critical` (bitácora)
7. **Ctrl + S**

## 5.3 Checklist final CU36

- [ ] UC37 con `<<include>>` hacia detectar/seleccionar/calcular/notificar/bitácora; `<<extend>>` hacia crear orden manual y marcar como recibida.
- [ ] Comunicación: 8 enlaces, 3 flujos (automático / manual / marcar recibida).
- [ ] Clases: `COrdenCompraList`, `CCOrdenCompra` + 6 Entity.
- [ ] Secuencia: 8 lifelines, `alt` (sin insumos), `loop` ×2 anidados, `alt` anidado (email sí/no), `critical` (bitácora).
- [ ] Bitácora: `GENERAR_ORDENES_COMPRA_AUTO`, `CREAR_ORDEN_COMPRA`, `ACTUALIZAR_ORDEN_COMPRA`.

---
# 6. CU37 — GENERAR BRIEFING EJECUTIVO CON IA

## 6.1 Diseño funcional adoptado

1. **Proactivo, no reactivo**: a diferencia de todos los demás CU de este
   documento, se dispara automáticamente al abrir `/perfil` (landing
   post-login) o `/dashboard`, sin que el usuario pida nada explícitamente.
2. **Reutiliza cálculos ya existentes** — no inventa lógica de negocio
   nueva:
   - Stock bajo mínimo → mismo criterio que CU13.
   - Lotes por vencer (7 días) → mismo criterio que CU34.
   - Valor perdido del mes actual → `_calcular_valor_perdido_acumulado()`,
     reutilizada de CU29/CU25.
   - Órdenes automáticas generadas en los últimos 7 días → cuenta sobre
     `ORDEN_COMPRA` (CU36).
3. **La IA solo redacta, no calcula**: el contexto (JSON con los 4 puntos
   anteriores) se envía a OpenAI con instrucción explícita de no inventar
   datos fuera del JSON, y de responder en texto plano sin Markdown
   (máx. 120 palabras, viñetas, prioriza lo urgente).
4. **Dos superficies, un solo endpoint**: `BriefingIACard` (componente
   compartido) se usa en modo compacto en `/perfil` (3 primeras líneas +
   botón "Ver briefing completo") y en modo completo en `/dashboard`.

**No hay tabla nueva.** Solo lectura de `STOCK`, `DETALLE_LOTE`,
`MOVIMIENTO_INVENTARIO` (vía función de CU25), `ORDEN_COMPRA`, y un
INSERT en `DETALLE_BITACORA`.

## 6.2 Tabla descriptiva del caso de uso

| Campo | Detalle |
|-------|---------|
| **Caso de Uso** | CU37 — Generar Briefing Ejecutivo con IA |
| **Descripción** | Genera automáticamente, sin que el usuario pregunte nada, un resumen ejecutivo priorizado del estado del negocio (stock crítico, vencimientos, valor perdido, órdenes automáticas recientes), redactado por un modelo de lenguaje real (OpenAI). |
| **Propósito** | Dar visibilidad inmediata de lo urgente apenas el usuario entra al sistema, sin que tenga que navegar a 4 pantallas distintas para enterarse. |
| **Actores** | Administrador, Gerente (actor secundario: Servicio de IA OpenAI) |
| **Iniciador** | Se dispara automáticamente al cargar `/perfil` o `/dashboard` (no requiere una acción explícita de "generar") |
| **Precondiciones** | Usuario autenticado con rol administrador o gerente. `OPENAI_API_KEY` configurada en el servidor. |
| **Flujo Principal** | 1. El usuario inicia sesión y llega a "Perfil" (o entra a "Dashboard"). 2. El sistema consulta stock bajo mínimo, lotes por vencer, valor perdido del mes y órdenes automáticas recientes. 3. El sistema envía ese contexto a la IA pidiendo un resumen priorizado. 4. El sistema muestra el resumen en una card. 5. El sistema registra la consulta en bitácora. |
| **Flujo Alternativo** | A1. Desde el widget compacto de Perfil, el usuario presiona "Ver briefing completo" y navega al Dashboard, donde ve la versión completa. |
| **Postcondiciones** | El usuario ve un resumen redactado en lenguaje natural del estado actual del negocio. Se registra `CONSULTAR_BRIEFING_IA` en bitácora. |
| **Excepciones** | E1: Si `OPENAI_API_KEY` no está configurada o la llamada a OpenAI falla → error 503 "El agente de IA no está disponible", sin romper el resto de la página. |

---

## DIAGRAMA 1 — Caso de Uso

### 📋 ESPECIFICACIÓN

**Tipo:** UML Use Case Diagram
**Actores:** Administrador, Gerente (secundario: OpenAI)
**UC principal:** UC38 — Generar Briefing Ejecutivo con IA

**Sub-UCs:**

| Sub-UC | Relación | Tipo |
|--------|----------|------|
| Consultar Alertas de Stock (UC13) | `<<include>>` | Siempre se ejecuta — referencia externa a **UC13** |
| Consultar Caducidad (UC34) | `<<include>>` | Siempre se ejecuta — referencia externa a **UC34** |
| Calcular Valor Perdido del Mes (UC25) | `<<include>>` | Siempre se ejecuta — referencia externa a **UC25** |
| Consultar Órdenes Automáticas Recientes (UC37) | `<<include>>` | Siempre se ejecuta — referencia externa a **UC37** |
| Redactar Resumen (OpenAI) | `<<include>>` | Siempre se ejecuta |
| Registrar en Bitácora | `<<include>>` | Siempre se ejecuta |
| Ver Briefing Completo en el Dashboard | `<<extend>>` | Opcional — navegación desde el widget compacto |

**Notación:** UC13, UC34, UC25 y UC37 se dibujan como óvalos punteados
fuera del boundary (referencias externas), mismo criterio que CU29 con
UC25/UC26/UC27/UC24/UC13.

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Reportes y Análisis` → **Add Diagram...** → `UML Behavioral` → `Use Case`
2. Name: `CU37 - Diagrama de Caso de Uso` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor** `Administrador`/`Gerente`
4. Arrastra un segundo **Actor** `OpenAI` (secundario)
5. Arrastra **System Boundary**; dentro, **Use Case** para UC38 y "Ver Briefing Completo en el Dashboard"
6. **Fuera** del boundary, arrastra 4 **Use Case**: UC13, UC34, UC25, UC37 (referencias externas)
7. Conectar Actor → UC38 con **Association**; OpenAI → "Redactar Resumen" con **Association**
8. Conectar UC38 → las 4 referencias externas y "Redactar Resumen"/"Registrar Bitácora" con **Include**; UC38 → "Ver Briefing Completo" con **Extend**
9. **Ctrl + S**

---

## DIAGRAMA 2 — Comunicación

### 📋 ESPECIFICACIÓN

**Tipo:** UML Communication Diagram

#### Enlaces

| Enlace | Elementos |
|--------|-----------|
| L1 | ACT ↔ B1 `:CBriefingIACard` |
| L2 | B1 ↔ C1 `:CCBriefingIA` |
| L3 | C1 ↔ E1 `:STOCK` |
| L4 | C1 ↔ E2 `:DETALLE_LOTE` |
| L5 | C1 ↔ E3 `:MOVIMIENTO_INVENTARIO` *(vía función reutilizada de CU25)* |
| L6 | C1 ↔ E4 `:ORDEN_COMPRA` |
| L7 | C1 ↔ E5 `:DETALLE_BITACORA` |

#### Tabla de mensajes

**Flujo único — Generar y mostrar briefing**

| N° | Enlace | Dirección | Texto del mensaje |
|----|--------|-----------|---------------------|
| 1 | L1 | ACT → B1 | `cargarBriefing()` *(automático al entrar a Perfil/Dashboard)* |
| 1.1 | L2 | B1 → C1 | `generarBriefing()` |
| 1.2 | L3 | C1 → E1 | `SELECT cantidad, stock_min FROM stock JOIN insumo` |
| 1.3 | L3 | E1 → C1 | `List<insumo bajo mínimo>` |
| 1.4 | L4 | C1 → E2 | `SELECT * FROM detalle_lote WHERE fecha_vencimiento <= hoy+7` |
| 1.5 | L4 | E2 → C1 | `List<lote por vencer>` |
| 1.6 | L5 | C1 → E3 | `_calcular_reporte_valor_perdido() [función importada de CU25]` |
| 1.7 | L5 | E3 → C1 | `valorPerdidoMesActual` |
| 1.8 | L6 | C1 → E4 | `SELECT * FROM orden_compra WHERE generada_auto=true AND fecha >= hoy-7` |
| 1.9 | L6 | E4 → C1 | `ordenesRecientes` |
| 1.10 | L2 | C1 → C1 | `generarTextoIA(contexto) [HTTP POST a OpenAI Chat Completions]` |
| 1.11 | L7 | C1 → E5 | `registrarBitacora("CONSULTAR_BRIEFING_IA", detalles)` |
| 1.12 | L2 | C1 → B1 | `mostrarBriefing(resumen)` |

#### Descripción del diagrama de comunicación

**Qué hace el CU:** Junta 4 fuentes de datos de negocio ya calculadas por
otros CU, y le pide a un modelo de lenguaje real que redacte un resumen
priorizado — sin inventar ningún número.

**Flujo único:** no hay ramas de decisión del usuario; el único punto de
variación es si la IA está disponible o no (ver fragmento `alt` en
Secuencia).

**Particularidades técnicas:** es el primer CU del proyecto que integra
un LLM real (OpenAI), a diferencia de CU32 (Ciclo 4), donde "IA" se
refería únicamente al reconocimiento de voz del navegador.

**Bitácora:** `CONSULTAR_BRIEFING_IA`, sin datos sensibles (solo IP).

**Actor Principal:** Administrador, Gerente (secundario: OpenAI)

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Reportes y Análisis` → **Add Diagram...** → `UML Behavioral` → `Communication`
2. Name: `CU37 - Diagrama de Comunicación` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor** `Administrador`/`Gerente`
4. Toolbox → `Common` → arrastra **Class** para cada Boundary/Control/Entity → Stereotype
5. Conectar con **Link** según L1–L7
6. Mensajes jerárquicos del flujo único (1, 1.1...1.12)
7. **Ctrl + S**

---

## DIAGRAMA 3 — Clases de Análisis

### 📋 ESPECIFICACIÓN

**Tipo:** UML Class Diagram
**Layout obligatorio:** Actor (izq.) → Boundary → Control → Entity (der.)

#### Clases

**Boundary — CBriefingIACard**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | resumen: string |
| `-` | compacto: boolean |
| `-` | cargando: boolean |
| `+` | cargarBriefing(): void |

**Control — CCBriefingIA**

| Visibilidad | Miembro |
|-------------|---------|
| `+` | generarBriefing(): BriefingIA |
| `-` | insumosStockBajo(): List |
| `-` | lotesPorVencer(): List |
| `-` | ordenesAutomaticasRecientes(): List |

**Entity — CEStock**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | insumoId: int |
| `-` | cantidad: decimal |
| `-` | stockMin: decimal |

**Entity — CEDetalleLote**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | insumoId: int |
| `-` | fechaVencimiento: date |

**Entity — CEMovimientoInventario**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | tipo: string |
| `-` | valorPerdido: decimal |
| `-` | fechaMov: date |

**Entity — CEOrdenCompra**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | generadaAuto: boolean |
| `-` | estado: string |
| `-` | fecha: date |

**Entity — CEDetalleBitacora**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | accion: string |
| `-` | detalles: json |

#### Conexiones

| Desde | Hacia | Tipo EA 15 | Mult. Desde | Mult. Hacia | Etiqueta |
|-------|-------|------------|-------------|-------------|----------|
| ACT | CBriefingIACard | Association (continua) | — | — | — |
| CBriefingIACard | CCBriefingIA | Association (continua) | — | — | — |
| CCBriefingIA | CEStock | Association (continua) | 1 | 0..* | consulta (vía CU13) |
| CCBriefingIA | CEDetalleLote | Association (continua) | 1 | 0..* | consulta (vía CU34) |
| CCBriefingIA | CEMovimientoInventario | Association (continua) | 1 | 0..* | consulta (vía CU25) |
| CCBriefingIA | CEOrdenCompra | Association (continua) | 1 | 0..* | consulta (vía CU36) |
| CCBriefingIA | CEDetalleBitacora | Association (continua) | 1 | 1 | registra |

### 🖱️ PASOS EN EA 15

1. `Reportes y Análisis` → **Add Diagram...** → `UML Structural` → `Class`
2. Name: `CU37 - Diagrama de Clases (Análisis)` → **OK**
3. Actor izquierda, Boundary/Control/Entity con **Class + Stereotype**
4. Atributos/métodos vía **Features**
5. Conexiones **Association**, anotando "(vía CUxx)" en la etiqueta cuando la consulta reutiliza lógica de otro CU
6. **Ctrl + S**

---

## DIAGRAMA 4 — Secuencia

### 📋 ESPECIFICACIÓN

**Tipo:** UML Sequence Diagram

#### Lifelines (izquierda → derecha)

| Posición | Nombre | Estereotipo |
|----------|--------|--------------|
| 1° | Administrador / Gerente | — (actor) |
| 2° | `:CBriefingIACard` | `boundary` |
| 3° | `:CCBriefingIA` | `control` |
| 4° | `:STOCK` | `entity` |
| 5° | `:DETALLE_LOTE` | `entity` |
| 6° | `:MOVIMIENTO_INVENTARIO` | `entity` |
| 7° | `:ORDEN_COMPRA` | `entity` |
| 8° | `:DETALLE_BITACORA` | `entity` |

#### Tabla de mensajes

**Flujo único**

| N° | Desde | Hasta | Tipo flecha | Texto del mensaje |
|----|-------|-------|-------------|---------------------|
| 1 | Actor | LL2 | Síncrono | `cargarBriefing()` |
| 1.1 | LL2 | LL3 | Síncrono | `generarBriefing()` |
| 1.2 | LL3 | LL4 | Síncrono | `SELECT cantidad, stock_min FROM stock` |
| 1.3 | LL4 | LL3 | Retorno | `List<insumo bajo mínimo>` |
| 1.4 | LL3 | LL5 | Síncrono | `SELECT * FROM detalle_lote WHERE fecha_vencimiento <= hoy+7` |
| 1.5 | LL5 | LL3 | Retorno | `List<lote por vencer>` |
| 1.6 | LL3 | LL6 | Síncrono | `_calcular_reporte_valor_perdido()` |
| 1.7 | LL6 | LL3 | Retorno | `valorPerdidoMesActual` |
| 1.8 | LL3 | LL7 | Síncrono | `SELECT * FROM orden_compra WHERE generada_auto=true AND fecha >= hoy-7` |
| 1.9 | LL7 | LL3 | Retorno | `ordenesRecientes` |
| 1.10 | LL3 | LL3 | Síncrono | `generarTextoIA(contexto) [HTTP a OpenAI]` |
| 1.11 | LL3 | LL8 | Asíncrono | `registrarBitacora("CONSULTAR_BRIEFING_IA", detalles)` |
| 1.12 | LL3 | LL2 | Retorno | `BriefingIA {resumen}` |
| 1.13 | LL2 | Actor | Retorno | `mostrarBriefing()` |

#### Tabla de fragmentos

| Fragmento | Tipo | Guarda / Condición | Lifelines que abarca | Está dentro de |
|-----------|------|---------------------|------------------------|-----------------|
| F1 | `alt` | `[OPENAI_API_KEY configurada y responde] / [no configurada o falla → error 503]` | LL3 | Mensaje 1.10 |
| F2 | `critical` | *(sin guarda)* | LL3 → LL8 | Mensaje 1.11 |

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Reportes y Análisis` → **Add Diagram...** → `UML Behavioral` → `Sequence`
2. Name: `CU37 - Diagrama de Secuencia` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor**
4. Toolbox → `Common` → arrastra **Class** por lifeline → Stereotype
5. Mensajes según tabla
6. Fragmentos: `alt` (disponibilidad de OpenAI), `critical` (bitácora)
7. **Ctrl + S**

## 6.3 Checklist final CU37

- [ ] UC38 con `<<include>>` hacia UC13, UC34, UC25, UC37 (referencias externas) y "Redactar Resumen"/"Registrar Bitácora"; `<<extend>>` hacia "Ver Briefing Completo en el Dashboard".
- [ ] Comunicación: 7 enlaces, 1 flujo único, sin ramas de decisión del usuario.
- [ ] Clases: `CBriefingIACard`, `CCBriefingIA` + 5 Entity, todas reutilizadas de otros CU.
- [ ] Secuencia: 8 lifelines, `alt` (disponibilidad de OpenAI), `critical` (bitácora).
- [ ] Documentar explícitamente que la IA solo redacta — no calcula ni inventa ningún número (todos vienen de funciones ya auditadas de otros CU).
- [ ] Bitácora: `CONSULTAR_BRIEFING_IA`.

---
# 7. CU38 — GENERAR RECETAS SUGERIDAS CON IA

## 7.1 Diseño funcional adoptado

1. **Diferencia clave con CU24** ("Sugerir Menú por Temporada"): CU24
   **filtra** el catálogo de platos ya existente. CU38 **genera platos
   nuevos** que no existen en el catálogo — es generativo, no un filtro.
2. **Candidatos**: insumos con `DETALLE_LOTE.fecha_vencimiento` dentro de
   una ventana de 7 días **y** stock disponible (`> 0`), cruzados con su
   `FICHA_TECNICA.porcentaje_merma` (dato ya cargado desde CU22 — no se
   crea columna nueva).
3. **Priorización**: se ordenan primero por días restantes (ascendente) y
   luego por porcentaje de merma (descendente) — un insumo que vence
   pronto **y** tiene alta merma se prioriza antes que uno que solo
   cumple una de las dos condiciones.
4. **Generación**: se le pide a OpenAI, vía `response_format:
   json_object`, que proponga 1–2 platos con ingredientes aproximados y
   una justificación explícita mencionando días restantes y/o merma.
5. **Es de solo sugerencia**: no crea `PLATO` ni `RECETA` en la base,
   mismo criterio que CU24.

**No hay tabla nueva.** Solo lectura de `DETALLE_LOTE`, `STOCK`,
`FICHA_TECNICA`, `INSUMO`, y un INSERT en `DETALLE_BITACORA`.

## 7.2 Tabla descriptiva del caso de uso

| Campo | Detalle |
|-------|---------|
| **Caso de Uso** | CU38 — Generar Recetas Sugeridas con IA |
| **Descripción** | Genera 1 o 2 platos nuevos con IA, priorizando insumos próximos a vencer y con alta merma técnica, con ingredientes aproximados y una justificación redactada de por qué se eligieron esos insumos. |
| **Propósito** | Reducir el desperdicio de insumos por vencer/con alta merma, proponiendo activamente qué cocinar con ellos, en vez de solo alertar que existen. |
| **Actores** | Administrador, Gerente, Chef (actor secundario: Servicio de IA OpenAI) |
| **Iniciador** | Administrador, Gerente o Chef |
| **Precondiciones** | Usuario autenticado con alguno de los 3 roles. `OPENAI_API_KEY` configurada. Existen insumos con lote próximo a vencer y ficha técnica cargada (CU22). |
| **Flujo Principal** | 1. El usuario accede a "Recetas Sugeridas por IA" y presiona "Generar sugerencias". 2. El sistema detecta insumos próximos a vencer con stock disponible. 3. El sistema cruza cada insumo con su porcentaje de merma técnica. 4. El sistema prioriza por vencimiento y merma. 5. El sistema le pide a la IA que proponga platos con esos insumos. 6. El sistema muestra los platos sugeridos con su justificación. 7. El sistema registra la acción en bitácora. |
| **Flujo Alternativo** | A1. El usuario presiona "Generar de nuevo" para repetir la sugerencia con el mismo criterio. |
| **Postcondiciones** | El usuario ve 1–2 platos sugeridos con ingredientes y justificación. Se registra `GENERAR_RECETA_IA` en bitácora. No se crea ningún plato/receta en la base. |
| **Excepciones** | E1: Si no hay insumos próximos a vencer en la ventana de 7 días → `platos_sugeridos: []` con un mensaje, sin llamar a la IA (ahorra una llamada innecesaria a la API de pago). E2: Si la IA no devuelve JSON válido → error 503 "El agente de IA no está disponible". |

---

## DIAGRAMA 1 — Caso de Uso

### 📋 ESPECIFICACIÓN

**Tipo:** UML Use Case Diagram
**Actores:** Administrador, Gerente, Chef (secundario: OpenAI)
**UC principal:** UC39 — Generar Recetas Sugeridas con IA

**Sub-UCs:**

| Sub-UC | Relación | Tipo |
|--------|----------|------|
| Detectar Insumos Próximos a Vencer | `<<include>>` | Siempre se ejecuta |
| Consultar % de Merma Técnica (UC22) | `<<include>>` | Siempre se ejecuta — referencia externa a **UC22** |
| Priorizar por Vencimiento y Merma | `<<include>>` | Siempre se ejecuta |
| Generar Platos (OpenAI) | `<<include>>` | Siempre se ejecuta, salvo si no hay candidatos (ver E1) |
| Registrar en Bitácora | `<<include>>` | Siempre se ejecuta |
| Regenerar Sugerencias | `<<extend>>` | Opcional — repetición a pedido del usuario |

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Menús y Recetas` → **Add Diagram...** → `UML Behavioral` → `Use Case`
2. Name: `CU38 - Diagrama de Caso de Uso` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor** `Administrador`, `Gerente`, `Chef`
4. Arrastra un segundo **Actor** `OpenAI` (secundario)
5. Arrastra **System Boundary**; dentro, **Use Case** para UC39 y sus sub-UCs de include
6. **Fuera** del boundary, arrastra **Use Case** UC22 (referencia externa)
7. Conectar Actores → UC39 con **Association**; OpenAI → "Generar Platos" con **Association**
8. Conectar UC39 → sub-UCs de include con **Include**; UC39 → "Regenerar Sugerencias" con **Extend**
9. **Ctrl + S**

---

## DIAGRAMA 2 — Comunicación

### 📋 ESPECIFICACIÓN

**Tipo:** UML Communication Diagram

#### Enlaces

| Enlace | Elementos |
|--------|-----------|
| L1 | ACT ↔ B1 `:CRecetasIA` |
| L2 | B1 ↔ C1 `:CCRecetaIA` |
| L3 | C1 ↔ E1 `:DETALLE_LOTE` |
| L4 | C1 ↔ E2 `:STOCK` |
| L5 | C1 ↔ E3 `:FICHA_TECNICA` |
| L6 | C1 ↔ E4 `:DETALLE_BITACORA` |

#### Tabla de mensajes

**Flujo único — Generar sugerencias**

| N° | Enlace | Dirección | Texto del mensaje |
|----|--------|-----------|---------------------|
| 1 | L1 | ACT → B1 | `generarSugerencias()` |
| 1.1 | L2 | B1 → C1 | `sugerirRecetaIA()` |
| 1.2 | L3 | C1 → E1 | `SELECT * FROM detalle_lote WHERE fecha_vencimiento <= hoy+7` |
| 1.3 | L3 | E1 → C1 | `List<DetalleLote>` |
| 1.4 | L4 | C1 → E2 | `SELECT cantidad FROM stock WHERE id IN (...)` |
| 1.5 | L4 | E2 → C1 | `stockDisponible` |
| 1.6 | L5 | C1 → E3 | `SELECT porcentaje_merma FROM ficha_tecnica WHERE insumo_id IN (...)` |
| 1.7 | L5 | E3 → C1 | `List<merma por insumo>` |
| 1.8 | L2 | C1 → C1 | `priorizarCandidatos(diasRestantes, merma)` |
| 1.9 | L2 | C1 → C1 | `generarPlatosIA(candidatos) [HTTP POST a OpenAI, response_format=json_object]` |
| 1.10 | L6 | C1 → E4 | `registrarBitacora("GENERAR_RECETA_IA", detalles)` |
| 1.11 | L2 | C1 → B1 | `mostrarSugerencias(insumosConsiderados, platosSugeridos)` |

#### Descripción del diagrama de comunicación

**Qué hace el CU:** Detecta insumos por vencer con alta merma, y le pide a
la IA que proponga platos nuevos que los aprovechen, con una justificación
explícita.

**Flujo único:** repetible a pedido ("Generar de nuevo"), sin persistir
nada — cada corrida es independiente.

**Particularidades técnicas:** si `1.2`–`1.7` no devuelven candidatos, el
Control corta el flujo antes de `1.9` (no llama a la IA innecesariamente)
— ver fragmento `alt` en Secuencia.

**Bitácora:** `GENERAR_RECETA_IA`, con el conteo de insumos considerados y
platos sugeridos.

**Actor Principal:** Administrador, Gerente, Chef (secundario: OpenAI)

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Menús y Recetas` → **Add Diagram...** → `UML Behavioral` → `Communication`
2. Name: `CU38 - Diagrama de Comunicación` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor** `Administrador`/`Gerente`/`Chef`
4. Toolbox → `Common` → arrastra **Class** para cada Boundary/Control/Entity → Stereotype
5. Conectar con **Link** según L1–L6
6. Mensajes jerárquicos del flujo único (1, 1.1...1.11)
7. **Ctrl + S**

---

## DIAGRAMA 3 — Clases de Análisis

### 📋 ESPECIFICACIÓN

**Tipo:** UML Class Diagram
**Layout obligatorio:** Actor (izq.) → Boundary → Control → Entity (der.)

#### Clases

**Boundary — CRecetasIA**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | insumosConsiderados: List |
| `-` | platosSugeridos: List |
| `-` | cargando: boolean |
| `+` | generarSugerencias(): void |

**Control — CCRecetaIA**

| Visibilidad | Miembro |
|-------------|---------|
| `+` | sugerirRecetaIA(): SugerenciaRecetaIA |
| `-` | insumosCandidatos(): List |
| `-` | priorizarCandidatos(candidatos: List): List |

**Entity — CEDetalleLote**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | insumoId: int |
| `-` | stockId: int |
| `-` | fechaVencimiento: date |

**Entity — CEStock**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | cantidad: decimal |

**Entity — CEFichaTecnica**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | insumoId: int |
| `-` | porcentajeMerma: decimal |

**Entity — CEInsumo**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | nombre: string |
| `-` | categoria: string |

**Entity — CEDetalleBitacora**

| Visibilidad | Miembro |
|-------------|---------|
| `-` | id: int |
| `-` | accion: string |
| `-` | detalles: json |

#### Conexiones

| Desde | Hacia | Tipo EA 15 | Mult. Desde | Mult. Hacia | Etiqueta |
|-------|-------|------------|-------------|-------------|----------|
| ACT | CRecetasIA | Association (continua) | — | — | — |
| CRecetasIA | CCRecetaIA | Association (continua) | — | — | — |
| CCRecetaIA | CEDetalleLote | Association (continua) | 1 | 0..* | detecta |
| CCRecetaIA | CEStock | Association (continua) | 1 | 0..* | valida disponibilidad |
| CCRecetaIA | CEFichaTecnica | Association (continua) | 1 | 0..* | consulta merma (vía CU22) |
| CEDetalleLote | CEInsumo | Association (continua) | 1..* | 1 | pertenece a |
| CCRecetaIA | CEDetalleBitacora | Association (continua) | 1 | 1 | registra |

### 🖱️ PASOS EN EA 15

1. `Menús y Recetas` → **Add Diagram...** → `UML Structural` → `Class`
2. Name: `CU38 - Diagrama de Clases (Análisis)` → **OK**
3. Actor izquierda, Boundary/Control/Entity con **Class + Stereotype**
4. Atributos/métodos vía **Features**
5. Conexiones **Association**
6. **Ctrl + S**

---

## DIAGRAMA 4 — Secuencia

### 📋 ESPECIFICACIÓN

**Tipo:** UML Sequence Diagram

#### Lifelines (izquierda → derecha)

| Posición | Nombre | Estereotipo |
|----------|--------|--------------|
| 1° | Administrador / Gerente / Chef | — (actor) |
| 2° | `:CRecetasIA` | `boundary` |
| 3° | `:CCRecetaIA` | `control` |
| 4° | `:DETALLE_LOTE` | `entity` |
| 5° | `:STOCK` | `entity` |
| 6° | `:FICHA_TECNICA` | `entity` |
| 7° | `:DETALLE_BITACORA` | `entity` |

#### Tabla de mensajes

**Flujo único**

| N° | Desde | Hasta | Tipo flecha | Texto del mensaje |
|----|-------|-------|-------------|---------------------|
| 1 | Actor | LL2 | Síncrono | `generarSugerencias()` |
| 1.1 | LL2 | LL3 | Síncrono | `sugerirRecetaIA()` |
| 1.2 | LL3 | LL4 | Síncrono | `SELECT * FROM detalle_lote WHERE fecha_vencimiento <= hoy+7` |
| 1.3 | LL4 | LL3 | Retorno | `List<DetalleLote>` |
| 1.4 | LL3 | LL5 | Síncrono | `SELECT cantidad FROM stock WHERE id IN (...)` |
| 1.5 | LL5 | LL3 | Retorno | `stockDisponible` |
| 1.6 | LL3 | LL6 | Síncrono | `SELECT porcentaje_merma FROM ficha_tecnica WHERE insumo_id IN (...)` |
| 1.7 | LL6 | LL3 | Retorno | `List<merma por insumo>` |
| 1.8 | LL3 | LL3 | Síncrono | `priorizarCandidatos(diasRestantes, merma)` |
| 1.9 | LL3 | LL3 | Síncrono | `generarPlatosIA(candidatos) [HTTP a OpenAI, JSON forzado]` |
| 1.10 | LL3 | LL7 | Asíncrono | `registrarBitacora("GENERAR_RECETA_IA", detalles)` |
| 1.11 | LL3 | LL2 | Retorno | `SugerenciaRecetaIA {insumosConsiderados, platosSugeridos}` |
| 1.12 | LL2 | Actor | Retorno | `mostrarSugerencias()` |

#### Tabla de fragmentos

| Fragmento | Tipo | Guarda / Condición | Lifelines que abarca | Está dentro de |
|-----------|------|---------------------|------------------------|-----------------|
| F1 | `alt` | `[hay insumos candidatos] / [no hay → retornar sin llamar a la IA]` | LL3 | Antes de 1.9 |
| F2 | `alt` | `[OpenAI responde JSON válido] / [JSON inválido o error → 503]` | LL3 | Mensaje 1.9 |
| F3 | `critical` | *(sin guarda)* | LL3 → LL7 | Mensaje 1.10 |

### 🖱️ PASOS EN EA 15

1. Clic derecho en `Menús y Recetas` → **Add Diagram...** → `UML Behavioral` → `Sequence`
2. Name: `CU38 - Diagrama de Secuencia` → **OK**
3. Toolbox → `Use Case` → arrastra **Actor**
4. Toolbox → `Common` → arrastra **Class** por lifeline → Stereotype
5. Mensajes según tabla
6. Fragmentos: `alt` (sin candidatos), `alt` anidado/siguiente (JSON válido), `critical` (bitácora)
7. **Ctrl + S**

## 7.3 Checklist final CU38

- [ ] UC39 con `<<include>>` hacia detectar/consultar merma (UC22)/priorizar/generar/bitácora; `<<extend>>` hacia "Regenerar Sugerencias".
- [ ] Comunicación: 6 enlaces, 1 flujo único, corta antes de llamar a la IA si no hay candidatos.
- [ ] Clases: `CRecetasIA`, `CCRecetaIA` + 5 Entity (incluye `CEFichaTecnica` vía CU22).
- [ ] Secuencia: 7 lifelines, `alt` (sin candidatos), `alt` (JSON válido/inválido), `critical` (bitácora).
- [ ] Documentar explícitamente la diferencia con CU24: CU38 genera platos nuevos, CU24 solo filtra el catálogo existente.
- [ ] Bitácora: `GENERAR_RECETA_IA`.

---
# 8. TABLA RESUMEN DE BITÁCORA — CICLO 5

| CU | Acción registrada | Cuándo se registra |
|----|---------------------|----------------------|
| CU33 | `ENVIAR_NOTIFICACION_ALERTAS` | Solo si había alertas o lotes pendientes (se intentó el envío) |
| CU34 | *(ninguna)* | CU de solo lectura, sin bitácora (igual criterio que CU29) |
| CU35 | `CAPTURAR_PAGO_PAYPAL` / `APROBAR_PAGO_MANUAL` / `RECHAZAR_PAGO_MANUAL` | Al capturar automáticamente, o al aprobar/rechazar manualmente |
| CU36 | `GENERAR_ORDENES_COMPRA_AUTO` / `CREAR_ORDEN_COMPRA` / `ACTUALIZAR_ORDEN_COMPRA` | Según el flujo (automático, manual, cambio de estado) |
| CU37 | `CONSULTAR_BRIEFING_IA` | Cada vez que se genera el briefing (automático al entrar) |
| CU38 | `GENERAR_RECETA_IA` | Solo si hubo candidatos y se llamó a la IA |

---

# 9. DEPENDENCIAS Y REUTILIZACIÓN ENTRE CUs DEL CICLO 5

| Función/criterio reutilizado | Definido en (CU original) | Reutilizada por |
|-------------------------------|------------------------------|--------------------|
| Criterio de alertas de stock no leídas | CU13 (Ciclo 3) | **CU33 (nuevo)**, **CU37 (nuevo)** |
| Criterio de lotes por vencer (`fecha_vencimiento <= hoy+N`) | **CU34 (nuevo)** | **CU33 (nuevo)**, **CU37 (nuevo)**, **CU38 (nuevo, ventana fija 7 días)** |
| `_calcular_valor_perdido_acumulado()` / `_calcular_reporte_valor_perdido()` | CU25 (Ciclo 4, Mateo) | **CU37 (nuevo)** |
| Conteo de órdenes automáticas recientes | **CU36 (nuevo)** | **CU37 (nuevo)** |
| `enviar_email()` (Resend, HTTP) | **CU33 (nuevo)** | **CU36 (nuevo)**, extendida para aceptar cuerpo HTML |
| `porcentaje_merma` de FICHA_TECNICA | CU22 (Ciclo 3) | **CU38 (nuevo)** |
| `generar_texto_ia()` / `generar_json_ia()` (OpenAI, HTTP) | `nucleo/openai_utils.py` (nuevo, compartido) | **CU37 (nuevo, texto plano)**, **CU38 (nuevo, JSON forzado)** |
| Patrón de auto-mensaje para servicio externo (`B1→B1` o `C1→C1`) | CU32 (Ciclo 4, Web Speech API) | **CU33/CU36 (Resend)**, **CU35 (PayPal)**, **CU37/CU38 (OpenAI)** |

> **Nota:** CU37 es, junto con CU29 (Ciclo 4), el CU que más reutiliza
> lógica de otros — a diferencia de CU29 (que solo agrega números), CU37
> además le pasa ese contexto a un modelo de lenguaje real para que lo
> redacte, en vez de solo mostrarlo en cards numéricas.

---

# 10. ACTUALIZACIÓN DEL MODELO GLOBAL DE CASOS DE USO ("Ciclo #4 (Final)")

El diagrama maestro que agrupa TODOS los actores y CU del sistema (el que
adjuntaste como IMG 1, título "CICLO #4 (FINAL)") debe pasar a llamarse
**"CICLO #5 (FINAL)"** y sumar lo siguiente, sin tocar lo ya existente:

## 10.1 Actor nuevo

- **API de OpenAI** — actor secundario, mismo estilo que "API de Stripe" y
  "API de Mapas" ya presentes en el diagrama. Se conecta a UC38 y UC39.

> `API de PayPal` como actor secundario **ya debería figurar** desde que
> se implementó CU35; si no está en el diagrama actual, agregarlo también
> junto a "API de Stripe" (mismo clúster de actores secundarios de pago).

## 10.2 Óvalos nuevos por actor principal

| Actor | Óvalos nuevos a conectar |
|-------|---------------------------|
| Chef | CU34 (Consultar Caducidad), CU38 (Generar Recetas con IA) |
| Administrador | CU33, CU34, CU35, CU36, CU37, CU38 (los 6 — el Administrador tiene acceso a todo) |
| Gerente | CU33, CU35, CU36, CU37, CU38 |

## 10.3 Ubicación sugerida en el lienzo

Agrupar los 6 óvalos nuevos cerca de sus clústeres de paquete ya
existentes en el diagrama (mismo criterio visual que ya usa el diagrama
para CU11–CU30):

- CU33, CU34 → cerca del clúster de "Inventario" (junto a CU11–CU15).
- CU35 → cerca del clúster de "Autenticación y Seguridad" / pagos (junto
  a CU31, donde ya está "API de Stripe").
- CU36 → cerca del clúster de "Proveedores" (junto a CU17–CU19).
- CU37 → cerca del clúster de "Reportes y Análisis" (junto a CU25–CU29).
- CU38 → cerca del clúster de "Menús y Recetas" (junto a CU20–CU24).

---

# 11. ACTUALIZACIÓN DEL DIAGRAMA DE ANÁLISIS DE PAQUETES

**Sí, el diagrama `pkg ANÁLISIS DE PAQUETES` (IMG 5) debe cambiar.** Los 6
paquetes existentes (Autenticación y Seguridad, Inventario, Proveedores,
Gestión de Insumos, Menús y Recetas, Reportes y Análisis) siguen siendo
los mismos — **no se crea ningún paquete nuevo** — pero aparece **una
dependencia nueva** que antes no existía:

## 11.1 Dependencia nueva a agregar

**`Reportes y Análisis` → `Proveedores`** (flecha punteada, dirección
única): CU37 (Briefing con IA) consulta `ORDEN_COMPRA`, que pertenece al
paquete Proveedores (CU36). Antes de este ciclo, "Reportes y Análisis" no
tenía ninguna dependencia declarada hacia "Proveedores".

## 11.2 Dependencias que se refuerzan (ya existían, ahora con más peso)

- `Inventario ↔ Reportes y Análisis`: ya existía (por CU25/CU26/CU29);
  CU33 y CU37 la refuerzan (ambos leen `ALERTAS_STOCK`/`DETALLE_LOTE`).
- `Menús y Recetas → Gestión de Insumos`: ya existía (por CU22); CU38 la
  refuerza (lee `FICHA_TECNICA.porcentaje_merma`).

## 11.3 Sin cambios

- `Autenticación y Seguridad` no gana dependencias nuevas: CU35 es
  autocontenido (solo usa `PAGOS_SISTEMA`, ya en ese paquete desde CU31).
- `Inventario → Proveedores` (o viceversa) ya existía en el diagrama
  original; CU36 no agrega una dirección nueva, solo la usa.

---

*Documento de especificación de diagramas · Ciclo 5 · Grupo #2 · SI1 · UNIVALLE*
*Basado en el formato del Ciclo 4*
*Fundamentos de include/extend verificados contra Rumbaugh/Jacobson/Booch*
*(UML Reference Manual) y Jacobson (Proceso Unificado de Desarrollo de Software)*
