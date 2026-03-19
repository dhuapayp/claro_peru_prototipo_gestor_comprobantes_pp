# Prompt para Agente (GitHub Copilot / Claude) — Aplicativo **Gestor de Comprobantes**

Eres un **agente de desarrollo** trabajando en **VS Code**. Tu objetivo es **diseñar e implementar** (o generar el plan técnico + artefactos de desarrollo) para el aplicativo **Gestor de Comprobantes** cumpliendo **estrictamente** los requerimientos funcionales, validaciones, reglas de negocio e integraciones descritas abajo, **sin omitir detalles**.

> **IMPORTANTE**
> - No inventes requisitos.  
> - Si detectas ambigüedades, propone supuestos **mínimos** y deja trazabilidad (lista de supuestos).  
> - Prioriza **seguridad**, **auditoría**, **trazabilidad**, **validación de datos** y **manejo de errores**.  
> - Toda la información mostrada debe consumirse mediante **servicios OData desarrollados en el E1** (C).  
> - El sistema debe persistir datos en **BD HANA** (analizar la BD actual en Oracle para replicar arquitectura/estructura/campos).

---

## 1) Contexto del Proceso

Este protocolo describe el proceso para el **registro de facturas electrónicas** a partir de:
- Un listado de **contratos** (conceptos y obligaciones de pago programadas por conceptos),
- o un listado de **documentos de compras** / **pólizas**.

El aplicativo debe permitir:
1. Visualizar el listado y detalle de documentos asociados a un proveedor.  
2. Registrar comprobantes asociados a contrato, orden de compra o póliza, aplicando validaciones y reglas de negocio.  
3. Visualizar o modificar comprobantes y sus documentos anexos (archivos XML y PDF).

---

## 2) Módulos / Flujos Principales

### 2.1 Visualización / Listado de Documentos
Implementar una pantalla con un **listado (grid)** de documentos vigentes asociados al proveedor con los campos:
- Número de documento  
- Valor del documento  
- Fecha de documento  
- Fecha de inicio de vigencia del contrato  
- Importe del documento  
- Moneda  
- Monto facturado a la fecha en el documento  
- Estado del documento  

Filtros:
- Tipo de documento  
- Número de documento  
- Fecha de documento  

Acción:
- Botón **“Visualizar Detalle”** por registro.

---

### 2.2 Detalle del Contrato y sus Conceptos
En el detalle del contrato mostrar:
- Número de contrato  
- Fechas de vigencia  
- Valor total del contrato  
- Moneda de contrato  
- Descripción del contrato  
- Unidad de negocio  
- Datos de interlocutores/acreedores  
- Condiciones de pago  
- Periodicidad de pagos  
- Datos contables  

Además, mostrar un listado de **Conceptos** del contrato con campos:
- Concepto  
- Frecuencia de pago  
- Valor total del concepto  

---

### 2.3 Detalle de la Orden de Compra / Póliza
En el detalle de OC o póliza mostrar:
- Número de documento  
- Fecha del documento  
- Posiciones  
- Código y descripción del servicio  
- Cantidad  
- Importe  
- Moneda  
- Estado del documento  

**Fuente de datos:**
- Toda la información de los documentos se obtiene desde las **nuevas interfaces** para contratos, órdenes de compra y pólizas.

Acción:
- Botón **“Registrar Comprobante”** que abre nueva pantalla para registrar factura.

---

## 3) Registro de Comprobante (Pantalla + Validaciones)

### 3.1 Acceso
- Al seleccionar y visualizar el detalle del documento se muestra el botón **“Registrar Comprobante”**.
- Al pulsar el botón se muestra la pantalla con los campos necesarios.

### 3.2 Campos y Cargas de Archivos
- Campo **Tipo de Factura**: el usuario selecciona si es **documento electrónico** o **físico**.
- Campo **Adjuntar archivo (PDF)**: el usuario carga el **PDF** de la representación de su factura. **Obligatorio**.
- **23-ene**: agregar validación para **leer el PDF** y validar que corresponde a la factura que se está registrando (**analizar uso de Document AI**).
- Botón **Cargar Archivo XML**: el usuario carga el **XML** de la factura. **Obligatorio**.
- Botón **Cargar CDR XML**: el usuario carga el **CDR XML** de la factura.
- Botón **Cargar otros**: el usuario puede cargar otros anexos en formato **PDF**.

### 3.3 Lectura de XML y Autocompletado
Cuando se carga el XML, el sistema debe leer tags internos e identificar/autocompletar:
- Tipo de documento de pago  
- Serie del documento de pago  
- Número del documento  
- Fecha de emisión del comprobante de pago  
- RUC del proveedor (emisor) en el XML  
- RUC de Claro (receptor) en el XML  
- Moneda del documento  
- Indicador si está afecto a IGV  

Validaciones XML:
- Validar que el formato del archivo sea el correcto (lectura y formato).
- Validar que el XML tenga estructura **XSD válida (UBL 2.1 Perú)**.

Validaciones RUC:
- Validar que el **RUC del emisor** sea el mismo de la cuenta de usuario.
  - Implementar lectura de datos del usuario en **IAS** para validar usuario y RUC del proveedor al que pertenece.
- Validar que el **RUC del receptor** sea el de **America Movil Peru SAC**.

Autocompletar adicional desde XML:
- % detracción  
- % retención  
- Periodo: mes y año  
- Fecha de recepción: **fecha del día**  
- Indicador de impuesto  
- Clase de documento de pago  
- Condición de pago  

---

## 4) Flujos según Origen del Documento

### 4.1 Para Arrendamiento (Contratos)
Una vez cargada la información (PDF/XML/etc.), el usuario debe:
1. Seleccionar/agregar de un listado el **Concepto (Alquiler)** relacionado con su contrato que registrará en la factura.
2. Botón **Agregar concepto de pago**:
   - Muestra listado del **cronograma de pagos/obligaciones** por pagar asociado al contrato y al concepto de alquiler elegido.

#### 4.1.1 Listado 1 (General) — Cronograma de pagos
Mostrar campos:
- Concepto de pago  
- Tipo de unidad  
- Unidad de negocio  
- Frecuencia de pago  
- Fecha inicio y fin de la obligación  
- Moneda e importe de la obligación programada  
- Moneda e importe pagado a la fecha (de las obligaciones programadas)  

Este listado es una lista general de conceptos pagados y pendientes relacionados con la posición/concepto del contrato.

**Fuente de datos:**
- Obtener datos desde SAP con interfaces para:
  - Consulta de **registro contable de facturas**
  - Consulta de **registro contable de pago de facturas**

---

### 4.2 Asignación de Obligaciones de Pago (Contratos)
#### 4.2.1 Listado 2 — Obligaciones pendientes de registrar facturas
Mostrar campos:
- Mes de pago  
- Fecha de inicio  
- Fecha de fin  
- Moneda y valor de las obligaciones  
- Monto IGV  
- Monto inafecto  
- Monto total  
- Cuenta contable y descripción del concepto de pago  
- Consumo (% de consumo)  
- Glosa de pago: **(ALQ JUN-25 LL_3108 SECADA ALTA)**  
  - Regla: (concepto, mes y año, unidad y descripción de la unidad)

Reglas:
- El usuario marca los **meses de pago** a registrar en la factura.
- Implementar validaciones respecto a **frecuencia** y **fecha de inicio**: controlar que seleccione todos los meses de acuerdo con la frecuencia de pago del concepto.
- Los campos del listado 1 y 2 **no pueden ser modificados**.

---

### 4.3 Para OC o Póliza
El usuario debe:
- Seleccionar del detalle de posiciones las posiciones a asignar al documento de compra.

Mostrar listado de posiciones del documento con:
- Número de documento  
- Fecha de documento  
- Posición del documento  
- Descripción del material o servicio  
- Cantidad  
- Importe  
- Moneda  
- Estado del documento de compra  

Filtros:
- Filtro por **estado de posiciones** del documento de compra.

Selección:
- Puede seleccionar **todas** las posiciones o posiciones **individuales**.

---

## 5) Asignar / Quitar y Actualizaciones

### 5.1 Botón “Asignar”
- Confirma y asocia:
  - Obligaciones programadas (contratos), **o**
  - Posiciones (OC/Póliza)
  a la factura que se está registrando.

Luego:
- Se actualiza la página y se muestra el listado de obligaciones/posiciones agregadas.

#### 5.1.1 Nuevo listado (post-asignación) para Contratos
Campos:
- Número de documento  
- Unidad de negocio  
- Concepto  
- Fecha inicio y fin de las obligaciones asignadas  
- Cuenta contable y descripción  
- Monto  
- Inafecto  
- Consumo (% de lo facturado)  
- Glosa de pago  
- Código de la unidad  
- Sufijo del concepto (ALQ)

#### 5.1.2 Nuevo listado (post-asignación) para Órdenes de compra
Campos:
- Número de documento  
- Fecha de documento  
- Cantidad  
- Importe  
- Moneda  

### 5.2 Botón “Quitar”
- Permite retirar obligaciones programadas/posiciones ya asignadas a la factura.

### 5.3 Recalcular campos luego de asignación
Al completar la asignación:
- Actualizar campos de:
  - % detracción  
  - % retención  
  - Periodo de registro (mes y año)
- Validar % de detracciones asociadas a conceptos u obligaciones programadas.

---

## 6) Validación Final de Importes y Confirmación

### 6.1 Ventana resumen (Validación XML vs asignaciones)
Mostrar una ventana resumen que compare importes del XML con obligaciones/posiciones asignadas y valide:
- Importe  
- Impuesto IGV  
- Valor inafecto  
- Valor total  
- Valor de detracción o retención  
- Importe neto final  

Regla:
- Si hay errores/diferencias, **no permitir** grabar/confirmar el registro.
- Diferencia máxima permitida: **1 sol**.

### 6.2 Botón “Registrar/Confirmar”
- Muestra ventana de confirmación: registrar y confirmar envío de la factura.

---

## 7) Estados del Registro de la Factura

- Si el usuario **Acepta**:
  - La factura se registra y se confirma el envío del registro,
  - Estado: **ENVIADO**.
- Si el usuario **No Acepta**:
  - La factura **solo** se registra (sin confirmar envío a bandeja contable),
  - Estado: **REGISTRADO**.

Con estado **REGISTRADO**:
- El proveedor **todavía puede modificar** su factura registrada.

Al confirmar envío:
- Se activa la interfaz que envía los archivos cargados por el proveedor hacia **ONBASE** (control documentario).

Persistencia:
- Guardar datos en **BD HANA** con el estado según selección del proveedor.
- Analizar BD actual en Oracle para replicar arquitectura, estructura y campos.

---

## 8) Consideraciones

- Evaluar repositorio de documentos: si seguirá siendo **ONBASE** o se cambiará a nuevo repositorio.
- CLARO debe gestionar y entregar datos para conexión con ONBASE.
- CLARO debe gestionar configuración y acceso a ONBASE desde BTP.
- En el nuevo modelo **no se utiliza** el concepto de **lotes**.
- Fase 2 (posible):
  - Evaluar registro masivo de contratos relacionados a una factura (proveedor: Sites del Peru),
  - Relevar proceso y validar con proveedor el uso del portal de proveedores.

---

## 9) Interfaces Requeridas (Integraciones)

- Obtener data maestra de objetos de real estate y documentos de compras.
- Obtener datos de contratos: detalles, condiciones/conceptos, cronograma obligaciones, estado de obligaciones desde Real Estate.
- Obtener datos de documentos de compra y sus detalles/posiciones asociadas.
- Obtener datos de registros contables de facturas registradas asociadas con documentos de compra y contratos (concepto y obligación programada).
- Obtener datos de registros contables de facturas pagadas asociadas con documentos de compra y contratos (concepto y obligación programada).
- Enviar archivos cargados por el proveedor hacia **ONBASE**.

---

## 10) Requisitos (A/C) adicionales de Integración

**(A) Integraciones con plataformas externas:**
- Integración con ONBASE para guardar anexos al registrar comprobante.
- Integración con SUNAT para consulta de estado de facturas emitidas por proveedores.
- Análisis y desarrollo de integraciones con SOVOS para obtener certificados de retenciones de facturas pagadas.

**(A) Rentas variables:**
- Permitir registro de montos, pero el registro del comprobante queda en estado **PENDIENTE** (debe pasar por flujos de validación/aprobación).

**(C) Flujos de aprobación:**
- Validar que existen flujos de aprobaciones para conceptos de rentas variables (gastos comunes, otros).

**(C) Restricción contractual:**
- Por norma, un contrato es solo para **1 objeto de alquiler** (no varios objetos en un solo contrato).
- Se puede tener **1 contrato con 2 interlocutores**.

---

## 11) Riesgos Potenciales

- Errores en la carga masiva de contratos. Contratos no actualizados como en PADMIN.
- Errores en la información histórica de pagos asociados con contratos, conceptos y obligaciones programadas.

---

## 12) Entregables Esperados del Agente

Genera, como mínimo:

1. **Arquitectura** (alto nivel) del aplicativo (frontend, backend, integraciones, persistencia HANA, ONBASE, IAS, SAP/OData E1).
2. **Modelo de dominio** (entidades: Proveedor, Documento, Contrato, Concepto, Obligación, Comprobante, Adjuntos, Estados, etc.).
3. **Diseño de pantallas** y navegación (listado, detalle, registro, asignación, resumen/validación, edición cuando aplique).
4. **Reglas de negocio y validaciones** implementables (XML/XSD UBL 2.1, RUC emisor/receptor, diferencia <= 1 sol, frecuencia de pagos, campos no editables, etc.).
5. **Contratos de API** (OData consumido desde E1; endpoints/servicios de backend propios si aplica) + manejo de errores.
6. **Persistencia en HANA** (tablas/estructuras) replicando lo necesario del modelo actual Oracle.
7. **Integraciones**:
   - ONBASE (subida/gestión de anexos),
   - SUNAT (estado de factura),
   - SOVOS (certificados de retención),
   - IAS (validación usuario ↔ RUC),
   - Document AI (lectura/validación PDF).
8. **Matriz de estados** y transiciones: REGISTRADO, ENVIADO, PENDIENTE (rentas variables), y permisos (modificación sólo cuando corresponda).
9. **Casos de prueba** (unitarios, integración, E2E) con criterios de aceptación.
10. **Checklist de seguridad** (validación de archivos, tamaños, antivirus si aplica, control de acceso, auditoría, logging, trazas).

---

## 13) Formato de Respuesta del Agente

Organiza tu salida en secciones numeradas y agrega:
- Supuestos mínimos (si los hay)
- Riesgos técnicos y mitigaciones
- Backlog sugerido (épicas/historias) con prioridad

Fin del prompt.
