# CICLO 5 — CASOS DE PRUEBA (Implementar Pruebas)
### CU33, CU34, CU35, CU36, CU37, CU38 · Grupo #2 · SI1 · UNIVALLE

> Mismo formato que los casos de prueba de CU7 (Gestionar Insumos), CU11
> (Gestionar Stock) y CU12 (Gestionar Lotes): Prueba de Aceptación,
> Entrada, Resultado, Condiciones, Procedimiento de Prueba.

---

## CASO DE PRUEBA 1: CU33 — ENVIAR NOTIFICACIÓN DE ALERTAS POR EMAIL

**REVISAR Y NOTIFICAR**

**PRUEBA DE ACEPTACIÓN**

Verificar que el sistema permita revisar en un solo paso las alertas de
stock pendientes y los lotes próximos a vencer, y enviar un correo
resumen a los usuarios con rol administrador, gerente o chef.

**ENTRADA**

Ventana de días: 7 (valor por defecto)
Debe existir al menos: 1 alerta de stock no leída **o** 1 lote por vencer

**RESULTADO**

El sistema envía un correo resumen a todos los usuarios con rol
administrador, gerente o chef que tengan email configurado, muestra un
mensaje de confirmación con el conteo de enviados/fallidos, y registra la
acción en bitácora.

**CONDICIONES**

El usuario debe haber iniciado sesión.
Debe tener rol Administrador o Gerente.
Deben existir usuarios destinatarios (administrador/gerente/chef) con
email cargado.

**PROCEDIMIENTO DE PRUEBA**

Ingresar al módulo "Inventario" y seleccionar "Alertas".
Verificar que existan alertas pendientes o lotes por vencer en la lista.
Presionar el botón "Revisar y notificar por email".
Esperar la respuesta del sistema.
Verificar el mensaje de confirmación con la cantidad de correos enviados.
Revisar la bandeja de entrada de un destinatario y confirmar la recepción
del correo con el resumen de alertas y vencimientos.

---

## CASO DE PRUEBA 2: CU34 — CONSULTAR CADUCIDAD (FEFO)

**LISTAR LOTES POR VENCIMIENTO**

**PRUEBA DE ACEPTACIÓN**

Comprobar que el sistema liste los lotes ordenados por fecha de
vencimiento ascendente (FEFO) y clasifique correctamente cada uno como
vencido, por vencer u ok.

**ENTRADA**

Ventana de días: 7 (valor por defecto)
Lotes de referencia: Tomate Perita (vencido), Leche Entera (por vencer en
3 días), Harina 0000 (ok, vence en 60 días)

**RESULTADO**

El sistema muestra la lista de lotes ordenada del que vence antes al que
vence después, con un badge de color por estado (rojo = vencido, naranja
= por vencer, verde = ok), sin modificar ninguna tabla (CU de solo
lectura).

**CONDICIONES**

El usuario debe haber iniciado sesión.
Debe tener rol Administrador o Chef.
Deben existir lotes registrados previamente (CU12/CU14).

**PROCEDIMIENTO DE PRUEBA**

Ingresar al módulo "Inventario" y seleccionar "Caducidad".
Verificar que la tabla cargue todos los lotes registrados.
Confirmar que el orden sea ascendente por fecha de vencimiento (el que
vence antes aparece primero).
Verificar que el badge de estado de cada lote coincida con su fecha
(vencido/por vencer/ok).
Cambiar la ventana de días (por ejemplo, de 7 a 3) y confirmar que la
clasificación "por vencer" se recalcula correctamente.

---

## CASO DE PRUEBA 3: CU35 — PROCESAR PAGO CON PAYPAL

**DEPOSITAR FONDOS CON PAYPAL**

**PRUEBA DE ACEPTACIÓN**

Validar que el sistema permita crear y capturar un pago con PayPal como
segunda pasarela de pago, registrando el resultado en el historial de
pagos.

**ENTRADA**

Monto a depositar: 50 Bs
Método de pago: PayPal (sandbox)

**RESULTADO**

El sistema crea la orden en PayPal, redirige al checkout, y al aprobar el
pago lo captura automáticamente, quedando registrado en "Historial de
Pagos" con estado "completado".

**CONDICIONES**

El usuario debe haber iniciado sesión con rol Administrador.
Las credenciales de PayPal (`PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET`)
deben estar configuradas en modo sandbox.

**PROCEDIMIENTO DE PRUEBA**

Ingresar al módulo "Depositar Fondos".
Ingresar el monto (50 Bs) y seleccionar PayPal como método.
Confirmar la creación de la orden y ser redirigido al checkout de
PayPal.
Aprobar el pago utilizando una cuenta de comprador sandbox.
Verificar que el sistema capture el pago automáticamente al volver de
PayPal.
Ingresar a "Historial de Pagos" y confirmar que el registro figure con
estado "completado".

**Prueba complementaria — Fallback manual:** si el webhook no confirma
automáticamente, ingresar a "Historial de Pagos", usar "Aprobar pago
manualmente" sobre el pago pendiente, y verificar que cambie a
"completado" y quede registrado en bitácora.

---

## CASO DE PRUEBA 4: CU36 — GENERAR ÓRDENES DE COMPRA AUTOMÁTICAS

**GENERAR AUTOMÁTICAS**

**PRUEBA DE ACEPTACIÓN**

Verificar que el sistema detecte automáticamente los insumos bajo el
stock mínimo, elija el proveedor de menor precio, agrupe en órdenes de
compra por proveedor y notifique por correo.

**ENTRADA**

Insumo: Tomate Perita (stock actual: 2, stock mínimo: 10)
Proveedores asociados: Distribuidora Andina (5 Bs), Mercado Central (8
Bs)

**RESULTADO**

El sistema genera una orden de compra para "Distribuidora Andina" (el
proveedor más barato), con la cantidad calculada como `stock_max −
cantidad_actual`, y envía el correo de notificación al proveedor.

**CONDICIONES**

El usuario debe haber iniciado sesión con rol Administrador o Gerente.
Deben existir insumos bajo stock mínimo con al menos un proveedor
asociado y precio cargado (CU17/CU18).

**PROCEDIMIENTO DE PRUEBA**

Ingresar al módulo "Proveedores" y seleccionar "Órdenes de Compra".
Presionar el botón "Generar automáticas".
Verificar el mensaje de resultado (cantidad de órdenes generadas).
Revisar en la tabla que la nueva orden liste el insumo, el proveedor
elegido (el de menor precio) y el total correcto.
Confirmar que el proveedor recibió el correo de notificación y que el
estado de la orden pasó a "enviada".

**Prueba complementaria — Orden manual:** presionar "Crear orden
manual", seleccionar un proveedor e insumos, y verificar que la orden se
cree con `generada_auto = false`.

---

## CASO DE PRUEBA 5: CU37 — GENERAR BRIEFING EJECUTIVO CON IA

**BRIEFING PROACTIVO**

**PRUEBA DE ACEPTACIÓN**

Comprobar que, al iniciar sesión, el sistema genere automáticamente (sin
que el usuario pregunte nada) un resumen ejecutivo priorizado del estado
del negocio, redactado por IA.

**ENTRADA**

*(No requiere datos manuales — se dispara automáticamente al cargar
"Perfil" o "Dashboard")*
Estado de referencia: al menos 1 insumo bajo stock mínimo y 1 lote por
vencer.

**RESULTADO**

En "Perfil" aparece un widget compacto con las primeras líneas del
briefing y un botón "Ver briefing completo en el Dashboard"; en
"Dashboard" se muestra la versión completa, priorizando lo más urgente
(vencimientos y stock crítico antes que cifras generales).

**CONDICIONES**

El usuario debe haber iniciado sesión con rol Administrador o Gerente.
La variable `OPENAI_API_KEY` debe estar configurada en el servidor.

**PROCEDIMIENTO DE PRUEBA**

Iniciar sesión con un usuario de rol Administrador o Gerente.
Verificar que en "Perfil" aparezca la card "Briefing del día — generado
por IA" con texto redactado (no vacío ni con errores de formato).
Presionar "Ver briefing completo en el Dashboard".
Verificar que en el Dashboard se muestre la versión completa del mismo
resumen, junto a los KPIs.
Confirmar que el texto prioriza los datos urgentes (stock bajo,
vencimientos) antes que las cifras generales.

---

## CASO DE PRUEBA 6: CU38 — GENERAR RECETAS SUGERIDAS CON IA

**GENERAR SUGERENCIAS**

**PRUEBA DE ACEPTACIÓN**

Verificar que el sistema genere platos nuevos con IA, priorizando
insumos próximos a vencer y con alta merma técnica, con ingredientes
aproximados y una justificación explícita.

**ENTRADA**

Insumo de referencia: Leche Entera (vence en 1 día, merma técnica no
aplica) y Zanahoria (vence en 3 días, 12% de merma técnica)

**RESULTADO**

El sistema muestra 1 o 2 platos sugeridos (que no existían en el
catálogo), cada uno con nombre, categoría, ingredientes aproximados y una
justificación que menciona explícitamente los días restantes y/o el
porcentaje de merma del insumo priorizado.

**CONDICIONES**

El usuario debe haber iniciado sesión con rol Administrador, Gerente o
Chef.
La variable `OPENAI_API_KEY` debe estar configurada.
Debe existir al menos un insumo con lote próximo a vencer (ventana de 7
días) y stock disponible.

**PROCEDIMIENTO DE PRUEBA**

Ingresar al módulo "Menús y Recetas" y seleccionar "Recetas Sugeridas por
IA".
Presionar el botón "Generar sugerencias".
Verificar que se listen los insumos considerados, cada uno con sus días
restantes y porcentaje de merma.
Verificar que se muestre al menos un plato sugerido, con ingredientes y
justificación coherente con los insumos priorizados.
Presionar "Generar de nuevo" y confirmar que el proceso se repite sin
errores.

**Excepción a probar:** si no hay ningún insumo próximo a vencer, verificar
que el sistema muestre el mensaje "No hay insumos próximos a vencer..."
sin llamar innecesariamente a la IA.

---

*Documento de Casos de Prueba · Ciclo 5 · Grupo #2 · SI1 · UNIVALLE*
*Formato basado en los casos de prueba de CU7, CU11 y CU12*
