/**
 * DemoTourService.js — Gestor de Comprobantes v2
 * Panel DOM flotante persistente (cross-route).
 *
 * FLUJOS SOPORTADOS por tipo de documento:
 *   CONTRATO  : 23 pasos (incluye selección de concepto, programación y pendientes)
 *   OC        : 20 pasos (posiciones de la orden de compra)
 *   Póliza    : 20 pasos (posiciones de la póliza)
 *
 * MEJORAS v2:
 *   • _highlightWithRetry — reintenta N veces tras navegación cross-route
 *   • _advanceWizard      — avanza el Wizard SAP al hacer clic en "Sig →"
 *   • pasos adaptativos según tipo de documento seleccionado
 *   • instrucciones detalladas paso a paso para operador sin experiencia previa
 */
sap.ui.define([], function () {
    "use strict";

    /* ── Estado del módulo ──────────────────────────────────────── */
    var _oRouter    = null;
    var _nCurrent   = 0;
    var _aSteps     = null;
    var _sDocType   = "CONTRATO";
    var _sDocId     = "DOC-001";
    var _sDocNum    = "4500012345";
    var PANEL_ID    = "cdt-panel";
    var BADGE_ID    = "cdt-badge";
    var FRAME_ID    = "cdt-frame";
    var _bMinimized = false;
    var _bDragged   = false;

    var ROLES = {
        proveedor: { label: "Proveedor", color: "#DA291C" }
    };

    /* ═══════════════════════════════════════════════════════════════
       DEFINICIÓN DE PASOS
    ═══════════════════════════════════════════════════════════════ */

    /** Pasos comunes 0-3 (iguales para todos los tipos) */
    function _getCommonSteps() {
        return [
            /* S0 */
            { role:"proveedor", panelSide:"right", targetId:null,
              title:"Bienvenida al Demo Tour",
              instruction:
                "Bienvenido a la <b>demo interactiva</b> del <b>Gestor de Comprobantes</b>.<br><br>" +
                "Este tour te guiará paso a paso por el flujo completo del proveedor:<br>" +
                "&bull; <b>Listado de Documentos</b> vigentes (contratos, OC, pólizas)<br>" +
                "&bull; <b>Detalle del Documento</b> seleccionado<br>" +
                "&bull; <b>Registro de Comprobante</b> con el formulario wizard de 4 pasos<br><br>" +
                "Pulsa <b>Sig &rarr;</b> en cada paso para avanzar.<br>" +
                "Donde el panel tenga una <b>Acción</b>, el sistema actuará automáticamente.<br>" +
                "Puedes pulsar <b>&larr; Ant</b> en cualquier momento para retroceder.",
              onEnter: function(r){ r.navTo("RouteDocumentList"); } },

            /* S1 */
            { role:"proveedor", panelSide:"right", targetId:"documentsPanel",
              title:"Vista: Listado de Documentos",
              instruction:
                "Esta es la <b>tabla principal de documentos</b>. Lista todos los documentos vigentes " +
                "asociados a tu empresa en una sola vista:<br><br>" +
                "&bull; <b>Contratos</b>, <b>&Oacute;rdenes de Compra</b> y <b>P&oacute;lizas</b> agrupados juntos<br>" +
                "&bull; Columnas: Estado, Tipo, N&uacute;mero, Fechas de Vigencia, Valor Total y Monto Facturado<br>" +
                "&bull; Los <b>KPIs</b> en la cabecera muestran el resumen global en PEN y USD<br>" +
                "&bull; Cada fila es un enlace &rarr; haz clic para ver el <b>Detalle</b> y gestionar sus facturas<br><br>" +
                "<b>Tip:</b> Los documentos con estado <span style='color:#DA291C;font-weight:600'>VENCIDO</span> " +
                "o <span style='color:#e9730c;font-weight:600'>SUSPENDIDO</span> no permiten registrar nuevas facturas.<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para explorar el panel de filtros.",
              onEnter: function(r){ r.navTo("RouteDocumentList"); } },

            /* S2 */
            { role:"proveedor", panelSide:"right", targetId:"filterPanel",
              title:"Panel de Filtros",
              instruction:
                "Usa los filtros para encontrar rápidamente el documento que necesitas:<br><br>" +
                "&bull; <b>Tipo de Documento:</b> filtra por Contrato, OC o Póliza<br>" +
                "&bull; <b>Número de Documento:</b> búsqueda exacta o parcial<br>" +
                "&bull; <b>Rango de Fechas:</b> acota por periodo de vigencia<br><br>" +
                "Pulsa <b>Buscar</b> para aplicar los filtros o <b>Limpiar</b> para reiniciar.<br><br>" +
                "<b>Tip:</b> Sin filtros activos se muestran <b>todos los documentos vigentes</b> del proveedor.<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para seleccionar un documento.",
              onEnter: null },

            /* S3 — espera a que el usuario (o autoAction) abra el detalle */
            { role:"proveedor", panelSide:"right", targetId:"documentsPanel",
              title:"Seleccionar un Documento",
              instruction:
                "La tabla resaltada muestra todos los documentos vigentes del proveedor.<br><br>" +
                "<div style='background:#fff8e1;border:1px solid #e9730c;border-radius:4px;padding:8px 10px;font-size:11px;text-align:center;margin-bottom:8px'>" +
                "<span style='font-size:16px'>&#128073;</span>&nbsp; " +
                "<b>Haz clic en cualquier fila</b> para continuar el tour con ese documento<br>" +
                "<span style='color:#777;font-size:10px'>El tour se adaptar&aacute; autom&aacute;ticamente seg&uacute;n el tipo elegido (Contrato, OC o P&oacute;liza)</span>" +
                "</div>" +
                "O pulsa <b>Sig &rarr;</b> y el sistema seleccionar&aacute; el <b>primer documento</b> autom&aacute;ticamente.",
              onEnter: null,
              listenAction: "abrirDetalle",
              autoAction: function() {
                  var oRow = document.querySelector('[id$="--documentsTable"] tbody tr.sapMListTblRow') ||
                             document.querySelector('[id$="--documentsTable"] .sapMListTblRow');
                  if (oRow) {
                      oRow.dispatchEvent(new MouseEvent("click", { bubbles:true, cancelable:true, view:window }));
                  }
              } }
        ];
    }

    /** Cola de pasos para CONTRATO (S4-S22, 19 pasos) */
    function _buildContratoSteps(sDocId, sDocNum) {
        return [
            /* S4 */
            { role:"proveedor", panelSide:"right", targetId:"sectionGeneral",
              title:"Detalle: Información General",
              instruction:
                "Estás en el <b>Detalle del Contrato</b>. La sección de <b>Información General</b> muestra:<br><br>" +
                "&bull; <b>Tipo y Número</b> del contrato (ej. " + sDocNum + ")<br>" +
                "&bull; <b>Fechas de Vigencia</b> (inicio y fin del contrato)<br>" +
                "&bull; <b>Estado</b> del contrato (VIGENTE, VENCIDO, SUSPENDIDO)<br>" +
                "&bull; <b>Valor Total</b> del contrato y <b>Monto Facturado</b> acumulado<br>" +
                "&bull; <b>Unidad de Negocio</b> responsable y descripción del objeto<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ver los conceptos de pago del contrato.",
              onEnter: function(r){
                  r.navTo("RouteDocumentDetail", {
                      documentId: sDocId, tipoDocumento: "CONTRATO", numeroDocumento: sDocNum
                  });
              } },

            /* S5 */
            { role:"proveedor", panelSide:"right", targetId:"sectionConceptos",
              title:"Detalle: Conceptos del Contrato",
              instruction:
                "La sección <b>Conceptos</b> muestra los tipos de pago configurados en el contrato:<br><br>" +
                "&bull; <b>ALQ</b> = Alquiler (pago mensual por uso del espacio)<br>" +
                "&bull; <b>GC</b> = Gastos Comunes (servicios del edificio/complejo)<br>" +
                "&bull; <b>OTR</b> = Otros conceptos contractuales<br><br>" +
                "Cada concepto tiene:<br>" +
                "&bull; <b>Frecuencia:</b> mensual, trimestral, anual<br>" +
                "&bull; <b>Valor unitario</b> y <b>valor total</b> del concepto<br><br>" +
                "Los conceptos generan <b>obligaciones de pago periódicas</b> que luego " +
                "asociarás a las facturas al registrarlas.<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ir a la sección de comprobantes.",
              onEnter: function() { _scrollObjPageToSection("sectionConceptos"); } },

            /* S6 */
            { role:"proveedor", panelSide:"right", targetId:"sectionComprobantes",
              title:"Sección: Comprobantes Registrados",
              instruction:
                "La sección <b>Comprobantes Registrados</b> muestra el historial completo de " +
                "facturas ya registradas para este contrato:<br><br>" +
                "&bull; <b>Serie-N\u00famero</b> de cada comprobante<br>" +
                "&bull; <b>Fecha</b> de emisi\u00f3n y fecha de registro<br>" +
                "&bull; <b>Importe Total</b> y <b>Estado</b> (REGISTRADO, ENVIADO, PAGADO)<br><br>" +
                "Desde aqu\u00ed tambi\u00e9n puedes:<br>" +
                "&bull; Hacer clic en una fila para <b>Ver el detalle</b> del comprobante<br>" +
                "&bull; Hacer clic en el \u00edcono de edici\u00f3n para <b>Modificar</b> un comprobante en estado REGISTRADO<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ir al bot\u00f3n de registrar un nuevo comprobante.",
              onEnter: function() { _scrollObjPageToSection("sectionComprobantes"); } },

            /* S7 */
            { role:"proveedor", panelSide:"left", targetId:"btnRegistrarComprobante",
              title:"Registrar un Nuevo Comprobante",
              instruction:
                "El bot\u00f3n <b>+ Registrar Comprobante</b> abre el formulario wizard de 4 pasos " +
                "para dar de alta una nueva factura en este contrato.<br><br>" +
                "<b>\u00bfCu\u00e1ndo usar este bot\u00f3n?</b><br>" +
                "Cada vez que emitas una factura relacionada a este contrato. Puedes registrar " +
                "m\u00faltiples comprobantes; cada uno quedar\u00e1 listado en esta secci\u00f3n con su estado.<br><br>" +
                "<span style='background:#fff3e0;border:1px solid #e9730c;border-radius:3px;padding:4px 7px;display:inline-block;font-size:11px'>" +
                "<b>Acci\u00f3n bidireccional:</b> Puedes hacer clic en el bot\u00f3n directamente " +
                "<i>o</i> pulsar <b>Sig &rarr;</b> en este panel &mdash; ambos avanzan el tour." +
                "</span>",
              onEnter: null,
              listenAction: "abrirRegistro",
              autoAction: function() { _firePress("btnRegistrarComprobante"); } },

            /* S8 */
            { role:"proveedor", panelSide:"right", targetId:"wizardStep1",
              title:"Wizard de Registro — Paso 1: Archivos",
              instruction:
                "El sistema usa un <b>Wizard de 4 pasos</b> para guiar el registro completo de la factura. " +
                "Observa el progreso en la barra superior.<br><br>" +
                "<b>Paso 1 — Documentos que debes cargar:</b><br>" +
                "&bull; <span style='color:#DA291C'>&#10033;</span> <b>XML de la factura</b> — obligatorio " +
                "(formato UBL 2.1 Perú, emitido y sellado por SUNAT)<br>" +
                "&bull; <span style='color:#DA291C'>&#10033;</span> <b>PDF de la factura</b> — obligatorio<br>" +
                "&bull; CDR XML (Constancia de Recepción SUNAT) — opcional pero recomendado<br>" +
                "&bull; Otros anexos (orden interna, acta de conformidad, etc.) — opcional<br><br>" +
                "<b>Proceso automático al cargar el XML:</b> el sistema extrae la serie, número, fechas, " +
                "RUCs e importes, y valida el RUC del emisor contra tu cuenta de proveedor.<br><br>" +
                "<b>Acción:</b> Pulsa <b>Sig &rarr;</b> para simular la carga del XML con datos demo.",
              onEnter: function(r){
                  r.navTo("RouteRegisterVoucher", {
                      documentId: sDocId, tipoDocumento: "CONTRATO", numeroDocumento: sDocNum
                  });
              },
              listenAction: "xmlCargado",
              autoAction: function() {
                  if (window.DemoTourSimulateDemoXML) { window.DemoTourSimulateDemoXML(); }
              } },

            /* S8 */
            { role:"proveedor", panelSide:"right", targetId:"wizardStep1",
              title:"Paso 1 Completado ✓ — Archivos Cargados",
              instruction:
                "¡Los archivos fueron procesados correctamente! Observa el estado en el panel:<br><br>" +
                "&bull; <span style='color:#107e3e;font-weight:700'>&#10003; XML cargado</span> — " +
                "F001-00001234.xml (datos extraídos y validados)<br>" +
                "&bull; <span style='color:#107e3e;font-weight:700'>&#10003; PDF cargado</span> — " +
                "F001-00001234.pdf<br><br>" +
                "<b>Validaciones realizadas:</b><br>" +
                "&bull; RUC Emisor validado contra tu cuenta &rarr; <span style='color:#107e3e'>Correcto ✓</span><br>" +
                "&bull; RUC Receptor de America Movil Peru &rarr; <span style='color:#107e3e'>Correcto ✓</span><br><br>" +
                "Los campos del <b>Paso 2</b> ya están <b>pre-rellenados</b> con la información del XML.<br><br>" +
                "<b>Acción:</b> Pulsa <b>Sig &rarr;</b> para avanzar al Paso 2 y revisar los datos extraídos.",
              onEnter: null,
              autoAction: function() { _advanceWizard(); },
              autoDelay: 700 },

            /* S9 */
            { role:"proveedor", panelSide:"right", targetId:"wizardStep2",
              title:"Paso 2: Datos del Comprobante",
              instruction:
                "El sistema <b>autocompletó</b> todos los campos con la información del XML. " +
                "Revisa que los datos sean correctos:<br><br>" +
                "&bull; <b>Tipo de comprobante:</b> 01 - Factura<br>" +
                "&bull; <b>Serie:</b> F001 &nbsp;&nbsp; <b>Número:</b> 00001234<br>" +
                "&bull; <b>Fecha de Emisión:</b> 26/03/2025<br>" +
                "&bull; <b>RUC Emisor:</b> 20601234560 &nbsp;<span style='color:#107e3e'>✓</span><br>" +
                "&bull; <b>RUC Receptor:</b> 701951741 &nbsp;<span style='color:#107e3e'>✓</span><br>" +
                "&bull; <b>Base Imponible (Valor Venta):</b> S/ 5,000.00<br>" +
                "&bull; <b>IGV (18%):</b> S/ 900.00<br>" +
                "&bull; <b>Monto Total:</b> S/ 5,900.00<br><br>" +
                "Puedes editar cualquier campo si hay alguna discrepancia con el comprobante físico.<br><br>" +
                "<b>Acción:</b> Pulsa <b>Sig &rarr;</b> para avanzar al Paso 3 (Asignación de Obligaciones).",
              onEnter: null,
              autoAction: function() { _advanceWizard(); },
              autoDelay: 700 },

            /* S10 */
            { role:"proveedor", panelSide:"right", targetId:"wizardStep3",
              title:"Paso 3: Asignar Obligaciones de Pago",
              instruction:
                "El <b>Paso 3</b> es el más importante del flujo: aquí asocias la factura a las " +
                "<b>obligaciones de pago</b> programadas del contrato.<br><br>" +
                "Verás <b>dos tablas</b> en este paso:<br>" +
                "&bull; <b>Tabla superior — Programación:</b> cronograma completo del concepto " +
                "(solo referencial, no se puede editar)<br>" +
                "&bull; <b>Tabla inferior — Pendientes por Facturar:</b> las obligaciones que " +
                "aún no tienen una factura asociada<br><br>" +
                "<b>El proceso a seguir es:</b><br>" +
                "1. Seleccionar el <b>Concepto</b> de pago en el selector<br>" +
                "2. Hacer clic en <b>+ Agregar</b> para cargar las tablas<br>" +
                "3. <b>Editar importes</b> si es necesario (Valor Venta / IGV)<br>" +
                "4. <b>Seleccionar</b> las filas a facturar (checkbox)<br>" +
                "5. Hacer clic en <b>Asignar</b><br><br>" +
                "<b>Acción:</b> Pulsa <b>Sig &rarr;</b> para comenzar seleccionando el concepto de pago.",
              onEnter: null },

            /* S11 */
            { role:"proveedor", panelSide:"right", targetId:"selectConcepto",
              title:"Seleccionar el Concepto de Pago",
              instruction:
                "El selector <b>Concepto de Pago</b> lista todos los tipos de pago " +
                "configurados en el contrato (ej. <b>ALQ - Alquiler</b>, <b>GC - Gastos Comunes</b>).<br><br>" +
                "<b>¿Qué debo seleccionar?</b><br>" +
                "El concepto que corresponde a los servicios que está facturando. Si la factura " +
                "cubre solo el alquiler mensual, selecciona <b>ALQ</b>.<br><br>" +
                "<b>Caso especial:</b> Si una sola factura cubre múltiples conceptos, deberías " +
                "registrar una factura por concepto (una para ALQ, otra para GC), ya que cada " +
                "concepto tiene su propia programación y cuentas contables.<br><br>" +
                "<b>Acción:</b> Pulsa <b>Sig &rarr;</b> para seleccionar el primer concepto automáticamente.",
              onEnter: null,
              autoAction: function() {
                  if (window.DemoTourSelectFirstConcepto) { window.DemoTourSelectFirstConcepto(); }
              },
              autoDelay: 800 },

            /* S12 */
            { role:"proveedor", panelSide:"right", targetId:"btnAgregarConcepto",
              title:"Cargar Obligaciones del Concepto",
              instruction:
                "El botón <b>+ Agregar</b> carga las dos tablas con los datos " +
                "del concepto seleccionado:<br><br>" +
                "&bull; <b>Tabla de Programación</b> (arriba): muestra TODAS las obligaciones " +
                "del cronograma — útil como consulta para verificar montos e IGV programados<br>" +
                "&bull; <b>Tabla de Pendientes</b> (abajo): muestra SOLO las obligaciones que " +
                "aún no tienen factura &rarr; estas son las que debes asignar<br><br>" +
                "<b>Nota:</b> Si el botón está deshabilitado, primero selecciona un concepto " +
                "en el selector de arriba.<br><br>" +
                "<b>Acción:</b> Pulsa <b>Sig &rarr;</b> para cargar las tablas automáticamente.",
              onEnter: null,
              autoAction: function() { _firePress("btnAgregarConcepto"); },
              autoDelay: 1500 },

            /* S13 */
            { role:"proveedor", panelSide:"right", targetId:"obligacionesTable",
              title:"Tabla de Programación (Referencia)",
              instruction:
                "La <b>Tabla de Programación</b> muestra el cronograma completo de pagos " +
                "del concepto seleccionado. Es <b>solo informativa</b>:<br><br>" +
                "&bull; <b>Periodo:</b> mes/año de cada obligación (ENE-2026, FEB-2026...)<br>" +
                "&bull; <b>Valor Venta (Base):</b> importe sin IGV<br>" +
                "&bull; <b>IGV:</b> monto del impuesto (18%)<br>" +
                "&bull; <b>Total:</b> importe total a pagar en ese periodo<br>" +
                "&bull; <b>Estado:</b> PENDIENTE (sin factura), FACTURADO o PAGADO<br><br>" +
                "<b>Usa esta tabla</b> para verificar que los importes de tu factura coincidan " +
                "con los montos programados en el contrato.<br><br>" +
                "La asignación real se hace en la tabla de <b>Pendientes</b> debajo.<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ir a seleccionar los pendientes a facturar.",
              onEnter: null },

            /* S14 */
            { role:"proveedor", panelSide:"right", targetId:"pendientesFactTable",
              title:"Tabla de Pendientes por Facturar",
              instruction:
                "La <b>Tabla de Pendientes</b> muestra las obligaciones que <b>aún no tienen " +
                "factura asociada</b>. Estas son las que debes seleccionar y asignar.<br><br>" +
                "Para cada fila puedes:<br>" +
                "&bull; <b>Editar el Valor Venta e IGV</b> directamente en la celda — útil cuando " +
                "el importe facturado difiere del programado (ej. descuentos, ajustes)<br>" +
                "&bull; <b>Asignar Cuenta Contable</b> usando el buscador de cuentas (&gt;)<br>" +
                "&bull; <b>Seleccionar</b> la fila con el checkbox de la columna izquierda<br><br>" +
                "<b>Consejo práctico:</b> Normalmente facturas <b>un periodo por factura</b> " +
                "(ej. ENE-2026). Si la factura cubre varios periodos, selecciónalos todos " +
                "pero sus importes deben sumar exactamente el total del XML.<br><br>" +
                "<b>Acción:</b> Pulsa <b>Sig &rarr;</b> para seleccionar el primer pendiente automáticamente.",
              onEnter: null,
              autoAction: function() {
                  if (window.DemoTourSelectAllPendientes) { window.DemoTourSelectAllPendientes(); }
              },
              autoDelay: 600 },

            /* S15 */
            { role:"proveedor", panelSide:"left", targetId:"btnRegistrarFactura",
              title:"Asignar las Obligaciones Pendientes",
              instruction:
                "El botón <b>Asignar</b> vincula las filas seleccionadas con esta factura.<br><br>" +
                "Tras asignar:<br>" +
                "&bull; Las filas se marcan en <span style='color:#107e3e;font-weight:700'>verde</span> " +
                "dentro de la tabla<br>" +
                "&bull; Aparecen en el <b>cuadro resumen</b> de asignaciones (sección inferior)<br>" +
                "&bull; El wizard avanza automáticamente al <b>Paso 4</b> (Validación)<br><br>" +
                "También puedes:<br>" +
                "&bull; <b>Desasignar</b> filas si asignaste por error — selecciónalas y pulsa Desasignar<br>" +
                "&bull; <b>Modificar importes</b> directamente en la tabla antes de asignar<br><br>" +
                "<b>Regla crítica:</b> La suma de los importes asignados debe coincidir con los " +
                "importes del XML (tolerancia ≤ S/ 1.00). Si no coincide, el Paso 4 mostrará " +
                "las diferencias y bloqueará el registro.<br><br>" +
                "<b>Acción:</b> Pulsa <b>Sig &rarr;</b> para asignar automáticamente.",
              onEnter: null,
              listenAction: "obligacionesAsignadas",
              autoAction: function() { _firePress("btnRegistrarFactura"); } },

            /* S16 */
            { role:"proveedor", panelSide:"right", targetId:"comparacionPanel",
              title:"Paso 4: Comparaci\u00f3n de Importes XML vs Asignado",
              instruction:
                "El <b>Paso 4</b> realiza la <b>validaci&oacute;n cruzada</b>: compara los importes del " +
                "XML con las obligaciones asignadas, campo por campo:<br><br>" +
                "<table style='width:100%;font-size:11px;border-collapse:collapse;margin-bottom:8px'>" +
                "<tr style='background:#f0f0f0;font-weight:600'><td style='padding:3px 5px'>Campo</td><td style='text-align:right;padding:3px 5px'>Del XML</td><td style='text-align:right;padding:3px 5px'>Asignado</td><td style='text-align:right;padding:3px 5px'>Diferencia</td></tr>" +
                "<tr style='border-bottom:1px solid #eee'><td style='padding:3px 5px'>Base Imponible</td><td style='text-align:right;padding:3px 5px'>5,000.00</td><td style='text-align:right;padding:3px 5px'>5,000.00</td><td style='text-align:right;padding:3px 5px;color:#107e3e;font-weight:600'>0.00 &#10003;</td></tr>" +
                "<tr style='border-bottom:1px solid #eee'><td style='padding:3px 5px'>IGV (18%)</td><td style='text-align:right;padding:3px 5px'>900.00</td><td style='text-align:right;padding:3px 5px'>900.00</td><td style='text-align:right;padding:3px 5px;color:#107e3e;font-weight:600'>0.00 &#10003;</td></tr>" +
                "<tr><td style='padding:3px 5px;font-weight:700'>Total</td><td style='text-align:right;padding:3px 5px;font-weight:700'>5,900.00</td><td style='text-align:right;padding:3px 5px;font-weight:700'>5,900.00</td><td style='text-align:right;padding:3px 5px;color:#107e3e;font-weight:700'>0.00 &#10003;</td></tr>" +
                "</table>" +
                "Tolerancia m&aacute;xima aceptada: <b>&le; S/ 1.00</b>. &nbsp;Resultado: <b>S/ 0.00</b> &rarr; " +
                "<span style='color:#107e3e;font-weight:700'>Validaci&oacute;n APROBADA &#10003;</span><br><br>" +
                "Si hubiera diferencias mayores, el sistema indicar&iacute;a los campos a corregir " +
                "y bloquear&iacute;a el registro hasta resolver.<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ver el resumen final del comprobante.",
              onEnter: null },

            /* S17 */
            { role:"proveedor", panelSide:"right", targetId:"resumenFinalPanel",
              title:"Resumen Final del Comprobante",
              instruction:
                "Antes de registrar, rev&iacute;sa el <b>resumen completo</b> de todo lo ingresado:<br><br>" +
                "<div style='background:#f8f8f8;border:1px solid #e0e0e0;border-radius:4px;padding:8px;font-size:11px;line-height:1.7'>" +
                "<div style='font-weight:700;color:#0854a0;border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:5px'>&#128196; Datos del Comprobante</div>" +
                "<div>Serie-N&uacute;mero: <b>F001-00001234</b> &nbsp;&bull;&nbsp; Tipo: <b>01 - Factura</b></div>" +
                "<div>Fecha: <b>26/03/2025</b> &nbsp;&bull;&nbsp; RUC Emisor: <b>20601234560</b> <span style='color:#107e3e'>&#10003;</span></div>" +
                "<div style='font-weight:700;color:#0854a0;border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:5px;margin-top:6px'>&#128181; Importes</div>" +
                "<div>Base Imponible: <b>S/ 5,000.00</b> &nbsp;&bull;&nbsp; IGV: <b>S/ 900.00</b> &nbsp;&bull;&nbsp; Total: <b>S/ 5,900.00</b></div>" +
                "<div style='font-weight:700;color:#0854a0;border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:5px;margin-top:6px'>&#128203; Obligaciones Asignadas</div>" +
                "<div>Contrato: <b>" + sDocNum + "</b> &nbsp;&bull;&nbsp; Concepto: <b>ALQ - Alquiler</b></div>" +
                "<div>Per&iacute;odo: <b>ENE-2026</b> &nbsp;&bull;&nbsp; Importe: <b>S/ 5,900.00</b> <span style='color:#107e3e'>&#10003;</span></div>" +
                "<div style='margin-top:7px;padding:4px 8px;background:#e8f5e9;border-radius:3px;color:#107e3e;font-weight:700;text-align:center'>&#10003;&nbsp; Todo correcto &mdash; Listo para registrar</div>" +
                "</div><br>" +
                "Pulsa <b>Sig &rarr;</b> para elegir c&oacute;mo registrar la factura.",
              onEnter: null },

            /* S18 */
            { role:"proveedor", panelSide:"left", targetId:"btnRegistrarEnviar",
              title:"Opciones de Registro",
              instruction:
                "El sistema ofrece <b>dos caminos</b> seg&uacute;n tu situaci&oacute;n:<br><br>" +
                "<div style='display:flex;gap:6px;font-size:11px;margin-bottom:10px'>" +
                "<div style='flex:1;border:2px solid #0854a0;border-radius:4px;padding:7px'>" +
                "<div style='font-weight:700;color:#0854a0;margin-bottom:5px'>&#128190; Solo Registrar</div>" +
                "<div style='margin-bottom:2px'><span style='color:#107e3e'>&#10003;</span> Estado: <b>REGISTRADO</b></div>" +
                "<div style='margin-bottom:2px'><span style='color:#107e3e'>&#10003;</span> Puedes editar</div>" +
                "<div style='margin-bottom:2px'><span style='color:#DA291C'>&#10005;</span> No va a Contabilidad</div>" +
                "<div style='color:#777;font-size:10px;margin-top:5px;font-style:italic'>Ideal para revisar antes<br>de enviar definitivamente</div>" +
                "</div>" +
                "<div style='flex:1;border:2px solid #107e3e;border-radius:4px;padding:7px'>" +
                "<div style='font-weight:700;color:#107e3e;margin-bottom:5px'>&#9993; Registrar y Enviar</div>" +
                "<div style='margin-bottom:2px'><span style='color:#107e3e'>&#10003;</span> Estado: <b>ENVIADO</b></div>" +
                "<div style='margin-bottom:2px'><span style='color:#DA291C'>&#10005;</span> No modificable</div>" +
                "<div style='margin-bottom:2px'><span style='color:#107e3e'>&#10003;</span> Va a Contabilidad</div>" +
                "<div style='color:#777;font-size:10px;margin-top:5px;font-style:italic'>Flujo definitivo,<br>inicia el proceso de pago</div>" +
                "</div>" +
                "</div>" +
                "<b>En esta demo</b> usamos <b>Registrar y Enviar</b> para el flujo completo.<br><br>" +
                "<b>Acci&oacute;n:</b> Pulsa <b>Sig &rarr;</b> para ejecutar <i>Registrar y Enviar</i>.",
              onEnter: null,
              listenAction: "comprobanteEnviado",
              autoAction: function() { _firePress("btnRegistrarEnviar"); } },

            /* S18 */
            { role:"proveedor", panelSide:"right", targetId:"demoNewComprobanteRow",
              title:"¡Comprobante Registrado y Enviado! 🎉",
              instruction:
                "¡La factura ha sido registrada con estado " +
                "<span style='color:#107e3e;font-weight:700'>ENVIADO</span>!<br><br>" +
                "Observa la nueva fila resaltada en la tabla de comprobantes — es la factura " +
                "que acabas de registrar con todos sus datos.<br><br>" +
                "<b>¿Qué ocurre a continuación? (flujo completo)</b><br>" +
                "&bull; El área de <b>Contabilidad</b> recibe la factura en su bandeja de aprobación<br>" +
                "&bull; Verifican la información y aprueban o devuelven la factura con observaciones<br>" +
                "&bull; Si se aprueba, el sistema de pagos programa automáticamente el <b>pago al proveedor</b><br>" +
                "&bull; El proveedor recibe la notificación de pago programado<br><br>" +
                "&#127881; <b>Demo completada con éxito</b> — Has recorrido el 100% del flujo de " +
                "registro de comprobantes del <b>Portal de Proveedores Claro</b>.<br><br>" +
                "Pulsa <b>&#10003; Finalizar</b> para cerrar el tour.",
              onEnter: function(r){
                  r.navTo("RouteDocumentDetail", {
                      documentId: sDocId, tipoDocumento: "CONTRATO", numeroDocumento: sDocNum
                  });
                  setTimeout(function() { _scrollObjPageToSection("sectionComprobantes"); }, 600);
              },
              highlightDelay: 1200 }
        ];
    }

    /** Cola de pasos para OC / Póliza (S4-S19, 16 pasos) */
    function _buildPosicionesSteps(sDocId, sDocNum, sDocType) {
        var bOC      = sDocType === "OC";
        var sTipo    = bOC ? "Orden de Compra" : "P\u00f3liza de Seguro";
        var sTipoRuta = bOC ? "OC" : "P\u00f3liza";
        var fTotal   = bOC ? "18,000.00" : "9,333.33";

        return [
            /* S4 */
            { role:"proveedor", panelSide:"right", targetId:"sectionGeneral",
              title:"Detalle: Información General",
              instruction:
                "Estás en el <b>Detalle de la " + sTipo + "</b>. " +
                "La sección <b>Información General</b> muestra:<br><br>" +
                "&bull; <b>Tipo y Número</b> del documento (" + sDocNum + ")<br>" +
                "&bull; <b>Fechas de Vigencia</b> y estado<br>" +
                "&bull; <b>Valor Total</b> del documento y <b>Monto Facturado</b> acumulado<br>" +
                "&bull; <b>Unidad de Negocio</b> y descripción del servicio contratado<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ver las posiciones del documento.",
              onEnter: function(r){
                  r.navTo("RouteDocumentDetail", {
                      documentId: sDocId, tipoDocumento: sTipoRuta, numeroDocumento: sDocNum
                  });
              } },

            /* S5 */
            { role:"proveedor", panelSide:"right", targetId:"sectionPosiciones",
              title:"Posiciones del Documento",
              instruction:
                "La sección <b>Posiciones</b> muestra cada ítem de servicio o bien contratado:<br><br>" +
                "&bull; <b>N&deg; Posición:</b> línea del documento (10, 20, 30...)<br>" +
                "&bull; <b>Código y Descripción:</b> servicio o material<br>" +
                "&bull; <b>Cantidad, Unidad y Precio Unitario</b><br>" +
                "&bull; <b>Importe Total</b> de la posición<br>" +
                "&bull; <b>Estado:</b> <span style='color:#e9730c'>PENDIENTE</span> (disponible) o " +
                "<span style='color:#107e3e'>FACTURADO</span> (ya tiene factura)<br><br>" +
                "Al registrar un comprobante, asociarás la factura a una o más posiciones PENDIENTE. " +
                "La suma de los importes seleccionados debe coincidir con el total del XML " +
                "(tolerancia ≤ S/ 1.00).<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ir a registrar la factura.",
              onEnter: function() { _scrollObjPageToSection("sectionPosiciones"); } },

            /* S6 */
            { role:"proveedor", panelSide:"right", targetId:"sectionComprobantes",
              title:"Sección: Comprobantes Registrados",
              instruction:
                "La secci\u00f3n <b>Comprobantes Registrados</b> muestra las facturas ya registradas " +
                "para este documento.<br><br>" +
                "Desde aqu\u00ed puedes:<br>" +
                "&bull; <b>Ver detalle</b> de un comprobante ya registrado<br>" +
                "&bull; <b>Editar</b> un comprobante con estado REGISTRADO<br>" +
                "&bull; <b>+ Registrar Comprobante</b> para a\u00f1adir una nueva factura<br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ir al bot\u00f3n de registrar un nuevo comprobante.",
              onEnter: function() { _scrollObjPageToSection("sectionComprobantes"); } },

            /* S7 */
            { role:"proveedor", panelSide:"left", targetId:"btnRegistrarComprobante",
              title:"Registrar un Nuevo Comprobante",
              instruction:
                "El bot\u00f3n <b>+ Registrar Comprobante</b> abre el formulario wizard de 4 pasos " +
                "para dar de alta una nueva factura en este documento.<br><br>" +
                "<b>\u00bfCu\u00e1ndo usar este bot\u00f3n?</b><br>" +
                "Cada vez que emitas una factura relacionada a este documento. Puedes registrar " +
                "m\u00faltiples comprobantes; cada uno quedar\u00e1 listado en esta secci\u00f3n con su estado.<br><br>" +
                "<span style='background:#fff3e0;border:1px solid #e9730c;border-radius:3px;padding:4px 7px;display:inline-block;font-size:11px'>" +
                "<b>Acci\u00f3n bidireccional:</b> Puedes hacer clic en el bot\u00f3n directamente " +
                "<i>o</i> pulsar <b>Sig &rarr;</b> en este panel &mdash; ambos avanzan el tour." +
                "</span>",
              onEnter: null,
              listenAction: "abrirRegistro",
              autoAction: function() { _firePress("btnRegistrarComprobante"); } },

            /* S8 */
            { role:"proveedor", panelSide:"right", targetId:"wizardStep1",
              title:"Wizard de Registro — Paso 1: Archivos",
              instruction:
                "El sistema usa un <b>Wizard de 4 pasos</b> para guiar el registro completo.<br><br>" +
                "<b>Paso 1 — Documentos que debes cargar:</b><br>" +
                "&bull; <span style='color:#DA291C'>&#10033;</span> <b>XML de la factura</b> — obligatorio<br>" +
                "&bull; <span style='color:#DA291C'>&#10033;</span> <b>PDF de la factura</b> — obligatorio<br>" +
                "&bull; CDR XML (Constancia SUNAT) — opcional<br>" +
                "&bull; Otros anexos — opcional<br><br>" +
                "El XML es <b>parseado automáticamente</b>: se extraen todos los datos de la " +
                "factura y se valida el RUC del emisor contra tu cuenta de proveedor.<br><br>" +
                "<b>Acción:</b> Pulsa <b>Sig &rarr;</b> para simular la carga del XML con datos demo.",
              onEnter: function(r){
                  r.navTo("RouteRegisterVoucher", {
                      documentId: sDocId, tipoDocumento: sTipoRuta, numeroDocumento: sDocNum
                  });
              },
              listenAction: "xmlCargado",
              autoAction: function() {
                  if (window.DemoTourSimulateDemoXML) { window.DemoTourSimulateDemoXML(); }
              } },

            /* S8 */
            { role:"proveedor", panelSide:"right", targetId:"wizardStep1",
              title:"Paso 1 Completado ✓ — Archivos Cargados",
              instruction:
                "¡Los archivos fueron procesados! Observa el estado:<br><br>" +
                "&bull; <span style='color:#107e3e;font-weight:700'>&#10003; XML cargado</span> — F001-00001234.xml<br>" +
                "&bull; <span style='color:#107e3e;font-weight:700'>&#10003; PDF cargado</span> — F001-00001234.pdf<br><br>" +
                "<b>Validaciones realizadas:</b><br>" +
                "&bull; RUC Emisor validado &rarr; <span style='color:#107e3e'>Correcto ✓</span><br>" +
                "&bull; RUC Receptor validado &rarr; <span style='color:#107e3e'>Correcto ✓</span><br><br>" +
                "Los campos del <b>Paso 2</b> están pre-rellenados con los datos del XML.<br><br>" +
                "<b>Acción:</b> Pulsa <b>Sig &rarr;</b> para avanzar al Paso 2.",
              onEnter: null,
              autoAction: function() { _advanceWizard(); },
              autoDelay: 700 },

            /* S9 */
            { role:"proveedor", panelSide:"right", targetId:"wizardStep2",
              title:"Paso 2: Datos del Comprobante",
              instruction:
                "Verifica los datos extraídos del XML:<br><br>" +
                "&bull; <b>Tipo:</b> 01 - Factura &nbsp;&nbsp; <b>Serie:</b> F001 &nbsp;&nbsp; <b>Número:</b> 00001234<br>" +
                "&bull; <b>Fecha de Emisión:</b> 26/03/2025<br>" +
                "&bull; <b>RUC Emisor</b> validado &nbsp;<span style='color:#107e3e'>✓</span><br>" +
                "&bull; <b>RUC Receptor</b> validado &nbsp;<span style='color:#107e3e'>✓</span><br>" +
                "&bull; <b>Total:</b> S/ " + fTotal + "<br><br>" +
                "Puedes editar cualquier campo si es necesario.<br><br>" +
                "<b>Acción:</b> Pulsa <b>Sig &rarr;</b> para avanzar al Paso 3 (Asignación de Posiciones).",
              onEnter: null,
              autoAction: function() { _advanceWizard(); },
              autoDelay: 700 },

            /* S10 */
            { role:"proveedor", panelSide:"right", targetId:"wizardStep3",
              title:"Paso 3: Asignar Posiciones del Documento",
              instruction:
                "En este paso asocias la factura a las <b>posiciones pendientes</b> del documento.<br><br>" +
                "La tabla muestra todas las posiciones con su estado:<br>" +
                "&bull; <span style='color:#e9730c;font-weight:700'>PENDIENTE</span> — disponibles para asignar<br>" +
                "&bull; <span style='color:#107e3e;font-weight:700'>FACTURADO</span> — ya tienen una factura<br><br>" +
                "<b>Proceso a seguir:</b><br>" +
                "1. Revisa la tabla y <b>selecciona</b> las posiciones que cubre esta factura<br>" +
                "2. Haz clic en <b>Asignar</b><br><br>" +
                "<b>Regla:</b> La suma de los importes de las posiciones debe coincidir con el " +
                "total del XML (tolerancia ≤ S/ 1.00).<br><br>" +
                "<b>Acción:</b> Pulsa <b>Sig &rarr;</b> para ver la tabla de posiciones.",
              onEnter: null },

            /* S11 */
            { role:"proveedor", panelSide:"right", targetId:"posicionesAsignacionTable",
              title:"Tabla de Posiciones — Seleccionar",
              instruction:
                "La tabla muestra todas las posiciones del documento.<br><br>" +
                "Para seleccionar posiciones:<br>" +
                "&bull; Haz clic en el <b>checkbox</b> de la izquierda de cada fila que quieres asignar<br>" +
                "&bull; O usa el botón <b>Sel. Todo</b> para seleccionar todas las posiciones PENDIENTE<br><br>" +
                "Consideraciones:<br>" +
                "&bull; Si la factura cubre <b>una posición</b> &rarr; selecciona solo esa fila<br>" +
                "&bull; Si cubre <b>varias posiciones</b> &rarr; selecciónalas todas " +
                "(la suma de importes debe = total XML)<br><br>" +
                "Las posiciones ya asignadas se marcan en " +
                "<span style='color:#107e3e;font-weight:700'>verde</span>.<br><br>" +
                "<b>Acción:</b> Pulsa <b>Sig &rarr;</b> para seleccionar la primera posición automáticamente.",
              onEnter: null,
              autoAction: function() {
                  if (window.DemoTourSelectFirstPosicion) { window.DemoTourSelectFirstPosicion(); }
              },
              autoDelay: 600 },

            /* S12 */
            { role:"proveedor", panelSide:"left", targetId:"btnAsignarPosiciones",
              title:"Asignar las Posiciones Seleccionadas",
              instruction:
                "El botón <b>Asignar</b> vincula las posiciones seleccionadas con esta factura.<br><br>" +
                "Tras asignar:<br>" +
                "&bull; Las filas se marcan en <span style='color:#107e3e;font-weight:700'>verde</span> " +
                "en la tabla<br>" +
                "&bull; Aparecen en el <b>cuadro resumen</b> de asignaciones debajo<br>" +
                "&bull; El wizard avanza automáticamente al <b>Paso 4</b> (Validación)<br><br>" +
                "Si asignaste por error:<br>" +
                "&bull; Selecciona la posición y usa el botón <b>Desasignar</b> para revertirlo<br><br>" +
                "<b>Acción:</b> Pulsa <b>Sig &rarr;</b> para asignar automáticamente.",
              onEnter: null,
              listenAction: "obligacionesAsignadas",
              autoAction: function() { _firePress("btnAsignarPosiciones"); } },

            /* S13 */
            { role:"proveedor", panelSide:"right", targetId:"comparacionPanel",
              title:"Paso 4: Comparaci\u00f3n de Importes XML vs Posiciones",
              instruction:
                "El <b>Paso 4</b> valida que los importes del XML coincidan con las posiciones asignadas:<br><br>" +
                "<table style='width:100%;font-size:11px;border-collapse:collapse;margin-bottom:8px'>" +
                "<tr style='background:#f0f0f0;font-weight:600'><td style='padding:3px 5px'>Campo</td><td style='text-align:right;padding:3px 5px'>Del XML</td><td style='text-align:right;padding:3px 5px'>Asignado</td><td style='text-align:right;padding:3px 5px'>Diferencia</td></tr>" +
                "<tr style='border-bottom:1px solid #eee'><td style='padding:3px 5px'>Importe Base</td><td style='text-align:right;padding:3px 5px'>" + fTotal + "</td><td style='text-align:right;padding:3px 5px'>" + fTotal + "</td><td style='text-align:right;padding:3px 5px;color:#107e3e;font-weight:600'>0.00 &#10003;</td></tr>" +
                "<tr><td style='padding:3px 5px;font-weight:700'>Total</td><td style='text-align:right;padding:3px 5px;font-weight:700'>" + fTotal + "</td><td style='text-align:right;padding:3px 5px;font-weight:700'>" + fTotal + "</td><td style='text-align:right;padding:3px 5px;color:#107e3e;font-weight:700'>0.00 &#10003;</td></tr>" +
                "</table>" +
                "Tolerancia m&aacute;xima: <b>&le; S/ 1.00</b>. &nbsp;Resultado: <b>S/ 0.00</b> &rarr; " +
                "<span style='color:#107e3e;font-weight:700'>Validaci&oacute;n APROBADA &#10003;</span><br><br>" +
                "Pulsa <b>Sig &rarr;</b> para ver el resumen final del comprobante.",
              onEnter: null },

            /* S14 */
            { role:"proveedor", panelSide:"right", targetId:"resumenFinalPanel",
              title:"Resumen Final del Comprobante",
              instruction:
                "Antes de registrar, rev&iacute;sa el <b>resumen completo</b> de todo lo ingresado:<br><br>" +
                "<div style='background:#f8f8f8;border:1px solid #e0e0e0;border-radius:4px;padding:8px;font-size:11px;line-height:1.7'>" +
                "<div style='font-weight:700;color:#0854a0;border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:5px'>&#128196; Datos del Comprobante</div>" +
                "<div>Serie-N&uacute;mero: <b>F001-00001234</b> &nbsp;&bull;&nbsp; Tipo: <b>01 - Factura</b></div>" +
                "<div>Fecha: <b>26/03/2025</b> &nbsp;&bull;&nbsp; RUC Emisor: <b>20601234560</b> <span style='color:#107e3e'>&#10003;</span></div>" +
                "<div style='font-weight:700;color:#0854a0;border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:5px;margin-top:6px'>&#128181; Importes</div>" +
                "<div>Total: <b>S/ " + fTotal + "</b> <span style='color:#107e3e'>&#10003;</span></div>" +
                "<div style='font-weight:700;color:#0854a0;border-bottom:1px solid #ddd;padding-bottom:3px;margin-bottom:5px;margin-top:6px'>&#128203; Posiciones Asignadas</div>" +
                "<div>Documento: <b>" + sDocNum + "</b></div>" +
                "<div>POS-001: <b>S/ " + fTotal + "</b> <span style='color:#107e3e'>&#10003;</span></div>" +
                "<div style='margin-top:7px;padding:4px 8px;background:#e8f5e9;border-radius:3px;color:#107e3e;font-weight:700;text-align:center'>&#10003;&nbsp; Todo correcto &mdash; Listo para registrar</div>" +
                "</div><br>" +
                "Pulsa <b>Sig &rarr;</b> para elegir c&oacute;mo registrar la factura.",
              onEnter: null },

            /* S15 */
            { role:"proveedor", panelSide:"left", targetId:"btnRegistrarEnviar",
              title:"Opciones de Registro",
              instruction:
                "El sistema ofrece <b>dos caminos</b> seg&uacute;n tu situaci&oacute;n:<br><br>" +
                "<div style='display:flex;gap:6px;font-size:11px;margin-bottom:10px'>" +
                "<div style='flex:1;border:2px solid #0854a0;border-radius:4px;padding:7px'>" +
                "<div style='font-weight:700;color:#0854a0;margin-bottom:5px'>&#128190; Solo Registrar</div>" +
                "<div style='margin-bottom:2px'><span style='color:#107e3e'>&#10003;</span> Estado: <b>REGISTRADO</b></div>" +
                "<div style='margin-bottom:2px'><span style='color:#107e3e'>&#10003;</span> Puedes editar</div>" +
                "<div style='margin-bottom:2px'><span style='color:#DA291C'>&#10005;</span> No va a Contabilidad</div>" +
                "<div style='color:#777;font-size:10px;margin-top:5px;font-style:italic'>Ideal para revisar antes<br>de enviar definitivamente</div>" +
                "</div>" +
                "<div style='flex:1;border:2px solid #107e3e;border-radius:4px;padding:7px'>" +
                "<div style='font-weight:700;color:#107e3e;margin-bottom:5px'>&#9993; Registrar y Enviar</div>" +
                "<div style='margin-bottom:2px'><span style='color:#107e3e'>&#10003;</span> Estado: <b>ENVIADO</b></div>" +
                "<div style='margin-bottom:2px'><span style='color:#DA291C'>&#10005;</span> No modificable</div>" +
                "<div style='margin-bottom:2px'><span style='color:#107e3e'>&#10003;</span> Va a Contabilidad</div>" +
                "<div style='color:#777;font-size:10px;margin-top:5px;font-style:italic'>Flujo definitivo,<br>inicia el proceso de pago</div>" +
                "</div>" +
                "</div>" +
                "<b>En esta demo</b> usamos <b>Registrar y Enviar</b> para el flujo completo.<br><br>" +
                "<b>Acci&oacute;n:</b> Pulsa <b>Sig &rarr;</b> para ejecutar <i>Registrar y Enviar</i>.",
              onEnter: null,
              listenAction: "comprobanteEnviado",
              autoAction: function() { _firePress("btnRegistrarEnviar"); } },

            /* S15 */
            { role:"proveedor", panelSide:"right", targetId:"demoNewComprobanteRow",
              title:"¡Comprobante Registrado y Enviado! 🎉",
              instruction:
                "¡La factura ha sido registrada con estado " +
                "<span style='color:#107e3e;font-weight:700'>ENVIADO</span>!<br><br>" +
                "Observa la nueva fila resaltada en la tabla de comprobantes — es la factura " +
                "que acabas de registrar con todos sus datos.<br><br>" +
                "<b>¿Qué ocurre a continuación?</b><br>" +
                "&bull; Contabilidad recibe la factura en su bandeja de aprobación<br>" +
                "&bull; Verifican y aprueban (o devuelven con observaciones)<br>" +
                "&bull; Si se aprueba, el sistema de pagos programa el pago al proveedor<br><br>" +
                "&#127881; <b>Demo completada</b> — Has recorrido el flujo completo del " +
                "<b>Portal de Proveedores Claro</b>.<br><br>" +
                "Pulsa <b>&#10003; Finalizar</b> para cerrar el tour.",
              onEnter: function(r){
                  r.navTo("RouteDocumentDetail", {
                      documentId: sDocId, tipoDocumento: sTipoRuta, numeroDocumento: sDocNum
                  });
                  setTimeout(function() { _scrollObjPageToSection("sectionComprobantes"); }, 600);
              },
              highlightDelay: 1200 }
        ];
    }

    /* ── Helpers DOM / SAPUI5 ───────────────────────────────────── */

    function _findEl(targetId) {
        if (!targetId) { return null; }
        if (targetId === "demoDocTableRow") {
            var oTbl = document.querySelector('[id$="--documentsTable"]');
            if (oTbl) {
                return oTbl.querySelector("tbody tr.sapMListTblRow") ||
                       oTbl.querySelector("tbody tr");
            }
            return null;
        }
        if (targetId === "demoNewComprobanteRow") {
            var oTbl2 = document.querySelector('[id$="--comprobantesTable"]');
            if (oTbl2) {
                var aRows = oTbl2.querySelectorAll("tbody tr.sapMListTblRow");
                return aRows.length ? aRows[aRows.length - 1] : null;
            }
            return null;
        }
        var mWiz = targetId.match(/^wizardStep(\d+)$/);
        if (mWiz) {
            var iIdx = parseInt(mWiz[1], 10) - 1;
            var oLi = document.querySelector(
                '[id$="--registerWizard-progressNavigator-step-' + iIdx + '"]'
            );
            if (oLi) { return oLi; }
        }
        return document.querySelector('[id$="--' + targetId + '"]') ||
               document.getElementById(targetId);
    }

    function _scrollObjPageToSection(targetId) {
        var oEl     = _findEl(targetId);
        var oPageEl = document.querySelector('[id$="--documentDetailPage"]');
        if (!oEl || !oPageEl) {
            if (oEl) { oEl.scrollIntoView({ behavior: "smooth", block: "start" }); }
            return;
        }
        try {
            var oPage    = sap.ui.getCore().byId(oPageEl.id);
            var oSection = sap.ui.getCore().byId(oEl.id);
            if (oPage && oSection && typeof oPage.scrollToSection === "function") {
                oPage.scrollToSection(oSection.getId(), 300);
            } else {
                oEl.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        } catch (e) {
            if (oEl) { oEl.scrollIntoView({ behavior: "smooth", block: "start" }); }
        }
    }

    function _firePressEl(oEl) {
        if (!oEl) { return false; }
        try {
            var oCtrl = sap.ui.getCore().byId(oEl.id);
            if (oCtrl && typeof oCtrl.firePress === "function") {
                oCtrl.firePress();
                return true;
            }
        } catch (e) { /* ignore */ }
        oEl.dispatchEvent(new MouseEvent("click", { bubbles:true, cancelable:true, view:window }));
        return true;
    }

    function _firePress(targetId) {
        return _firePressEl(_findEl(targetId));
    }

    /** Avanza el Wizard SAPUI5 al siguiente paso */
    function _advanceWizard() {
        var oWizEl = document.querySelector('[id$="--registerWizard"]');
        if (!oWizEl) { return; }
        try {
            var oWiz = sap.ui.getCore().byId(oWizEl.id);
            if (oWiz && typeof oWiz.nextStep === "function") {
                oWiz.nextStep();
                return;
            }
        } catch (e) { /* fallback */ }
        var oBtn = oWizEl.querySelector(".sapMWizardNextButton");
        if (oBtn) { oBtn.click(); }
    }

    /**
     * Resalta el elemento targetId con reintentos automáticos.
     * Soluciona el problema de highlight en pasos cross-route donde el DOM
     * todavía no está disponible al momento de navegar.
     */
    function _highlightWithRetry(targetId, color, maxTries, intervalMs) {
        _clearHighlight();
        if (!targetId) { return; }
        var tries  = 0;
        maxTries   = maxTries   || 20;
        intervalMs = intervalMs || 150;

        function attempt() {
            var oEl = _findEl(targetId);
            if (oEl) {
                var rCheck = _getTargetRect(oEl);
                if (rCheck.width === 0 && rCheck.height === 0) {
                    tries++;
                    if (tries < maxTries) { setTimeout(attempt, intervalMs); }
                    return;
                }
                _clearHighlight();
                oEl.style.setProperty("--cdt-color", color);
                var oOplEl = document.querySelector('[id$="--documentDetailPage"]');
                var bInsideOPL = oOplEl && oOplEl.contains(oEl);
                if (!bInsideOPL) {
                    oEl.scrollIntoView({ behavior: "instant", block: "center" });
                }
                setTimeout(function () { _placeBadge(oEl, color); }, 80);
                setTimeout(function () { _placeFrame(oEl, color); }, 80);
                /* Re-place after any pending scroll/layout settles */
                setTimeout(function () {
                    _placeBadge(oEl, color);
                    _placeFrame(oEl, color);
                }, 500);
                return;
            }
            tries++;
            if (tries < maxTries) {
                setTimeout(attempt, intervalMs);
            }
        }
        attempt();
    }

    /* ── Panel DOM ───────────────────────────────────────────────── */

    function _initDrag(oPanel) {
        var oHandle = oPanel.querySelector(".cdt-drag-handle");
        if (!oHandle) { return; }
        oHandle.addEventListener("mousedown", function (eDown) {
            if (eDown.target.tagName === "BUTTON") { return; }
            eDown.preventDefault();
            var rect    = oPanel.getBoundingClientRect();
            var offsetX = eDown.clientX - rect.left;
            var offsetY = eDown.clientY - rect.top;
            function onMove(eMove) {
                var nL = eMove.clientX - offsetX;
                var nT = eMove.clientY - offsetY;
                oPanel.style.left      = Math.max(4, Math.min(nL, window.innerWidth  - oPanel.offsetWidth  - 4)) + "px";
                oPanel.style.right     = "auto";
                oPanel.style.top       = Math.max(4, Math.min(nT, window.innerHeight - oPanel.offsetHeight - 4)) + "px";
                oPanel.style.transform = "none";
            }
            function onUp() {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup",  onUp);
                _bDragged = true;
            }
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup",  onUp);
        });
    }

    function _removeBadge() {
        var b = document.getElementById(BADGE_ID);
        if (b) { b.remove(); }
    }

    function _clearFrame() {
        var f = document.getElementById(FRAME_ID);
        if (f) { f.remove(); }
    }

    /**
     * Calcula el rect de un elemento. Para pasos del wizard progress nav,
     * excluye la línea separadora y retorna solo icono + título.
     */
    function _getTargetRect(oEl) {
        /* Detectar si es un <li> del progress navigator del wizard */
        if (oEl.tagName === "LI" && oEl.closest && oEl.closest(".sapMWizardProgressNav")) {
            /* Buscar el círculo (anchor o span con la clase del step circle) y el título */
            var oCircle = oEl.querySelector(".sapMWizardProgressNavAnchor") ||
                          oEl.querySelector("a") ||
                          oEl.querySelector("span.sapMWizardProgressNavStepCircle");
            var oTitle  = oEl.querySelector(".sapMWizardProgressNavStepTitle") ||
                          oEl.querySelector("span[class*='Title']");
            if (oCircle) {
                var rC = oCircle.getBoundingClientRect();
                if (oTitle && oTitle.getBoundingClientRect().width > 0) {
                    var rT = oTitle.getBoundingClientRect();
                    return {
                        top:    Math.min(rC.top, rT.top),
                        left:   Math.min(rC.left, rT.left),
                        right:  Math.max(rC.right, rT.right),
                        bottom: Math.max(rC.bottom, rT.bottom),
                        width:  Math.max(rC.right, rT.right) - Math.min(rC.left, rT.left),
                        height: Math.max(rC.bottom, rT.bottom) - Math.min(rC.top, rT.top)
                    };
                }
                return rC;
            }
        }
        return oEl.getBoundingClientRect();
    }

    /**
     * Dibuja un marco position:fixed sobre el elemento.
     * Funciona aunque los contenedores padre tengan overflow:hidden.
     */
    function _placeFrame(oEl, color) {
        if (!oEl) { _clearFrame(); return; }
        var rect = _getTargetRect(oEl);
        if (rect.width === 0 && rect.height === 0) { return; }
        var pad = 5;
        var frame = document.getElementById(FRAME_ID);
        if (!frame) {
            frame = document.createElement("div");
            frame.id = FRAME_ID;
            document.body.appendChild(frame);
        }
        frame.style.cssText =
            "position:fixed;z-index:8998;pointer-events:none;" +
            "top:"    + (rect.top    - pad) + "px;" +
            "left:"   + (rect.left   - pad) + "px;" +
            "width:"  + (rect.width  + pad * 2) + "px;" +
            "height:" + (rect.height + pad * 2) + "px;" +
            "border:3px solid " + color + ";" +
            "border-radius:6px;" +
            "box-shadow:0 0 0 5px " + color + "22;" +
            "animation:cdt-frame-pulse 1.4s ease-in-out infinite alternate;";
    }

    function _clearHighlight() {
        document.querySelectorAll(".cdt-highlight").forEach(function (el) {
            el.classList.remove("cdt-highlight");
        });
        _removeBadge();
        _clearFrame();
    }

    function _placeBadge(oEl, color) {
        if (!oEl) { _removeBadge(); return; }
        var rect = _getTargetRect(oEl);
        if (rect.width === 0 && rect.height === 0) { return; }
        var badge = document.getElementById(BADGE_ID);
        if (!badge) {
            badge = document.createElement("div");
            badge.id = BADGE_ID;
            badge.className = "cdt-badge";
            document.body.appendChild(badge);
        }
        badge.style.top  = Math.max(4, rect.top - 30) + "px";
        badge.style.left = rect.left + "px";
        badge.style.background = color;
        badge.innerHTML = "&#9654;&nbsp;Paso&nbsp;" + (_nCurrent + 1);
    }

    function _getPanel() { return document.getElementById(PANEL_ID); }

    function _createPanel() {
        var existing = _getPanel();
        if (existing) { existing.remove(); }
        var div = document.createElement("div");
        div.id = PANEL_ID;
        div.className = "cdt-panel";
        document.body.appendChild(div);
        return div;
    }

    function _positionPanel(panelSide) {
        var oPanel = _getPanel();
        if (!oPanel || _bDragged) { return; }
        oPanel.style.top       = "50%";
        oPanel.style.transform = "translateY(-50%)";
        if (panelSide === "left") {
            oPanel.style.left  = "14px";
            oPanel.style.right = "auto";
        } else {
            oPanel.style.right = "14px";
            oPanel.style.left  = "auto";
        }
    }



    function _renderStep(n) {
        var oPanel = _getPanel();
        if (!oPanel) { return; }
        var oStep  = _aSteps[n];
        var oRole  = ROLES[oStep.role];
        var nTotal = _aSteps.length;

        _positionPanel(oStep.panelSide);

        /* Lista de pasos */
        var sList = '<div class="cdt-list">';
        var sPrevRole = null;
        _aSteps.forEach(function (s, i) {
            if (s.role !== sPrevRole) {
                if (sPrevRole !== null) { sList += "</div>"; }
                sPrevRole = s.role;
                var r = ROLES[s.role];
                sList += '<div class="cdt-group">';
                sList += '<div class="cdt-group-lbl" style="color:' + r.color +
                         ';border-left:3px solid ' + r.color + '">' + r.label + '</div>';
            }
            var bDone = i < n, bActive = i === n;
            var bg = bActive ? oRole.color : (bDone ? "#888" : "#ddd");
            var fg = (bActive || bDone) ? "#fff" : "#aaa";
            var ic = bDone ? "&#10003;" : (bActive ? "&#9654;" : (i + 1));
            var rowStyle = bActive
                ? "background:#f5f5f5;border-left:3px solid " + oRole.color
                : "background:transparent;border-left:3px solid transparent";
            sList += '<div class="cdt-item" style="' + rowStyle + '">';
            sList += '<span class="cdt-dot" style="background:' + bg + ';color:' + fg + '">' + ic + '</span>';
            sList += '<span style="font-size:11px;line-height:1.3;color:' + (bActive ? "#111" : (bDone ? "#999" : "#ccc")) +
                     ';font-weight:' + (bActive ? "600" : "400") + '">' + s.title + '</span>';
            sList += '</div>';
        });
        sList += '</div></div>';

        var sCard =
            '<div class="cdt-card">' +
                '<div class="cdt-step-num" style="color:' + oRole.color + '">' +
                    'Paso ' + (n + 1) + ' / ' + nTotal + ' &middot; ' + oRole.label +
                '</div>' +
                '<div class="cdt-card-title">' + oStep.title + '</div>' +
                '<div class="cdt-card-body">' + oStep.instruction + '</div>' +
            '</div>';

        var sNextLbl = n === nTotal - 1 ? "&#10003;&nbsp;Finalizar" : "Sig&nbsp;&#8250;";
        var sNav =
            '<div class="cdt-nav">' +
                '<button class="cdt-btn-prev"' + (n === 0 ? " disabled" : "") +
                    ' onclick="window.DemoTour&&window.DemoTour.prev()">&#8249;&nbsp;Ant</button>' +
                '<span class="cdt-cnt">' + (n + 1) + '&nbsp;/&nbsp;' + nTotal + '</span>' +
                '<button class="cdt-btn-next" style="background:' + oRole.color +
                    '" onclick="window.DemoTour&&window.DemoTour.next()">' + sNextLbl + '</button>' +
            '</div>';

        var sMinIcon = _bMinimized ? '&#9650;' : '&#9660;';
        oPanel.innerHTML =
            '<div class="cdt-hdr cdt-drag-handle" style="background:' + oRole.color + '">' +
                '<span class="cdt-hdr-title">&#127916;&nbsp;Demo Tour &middot; ' + (n + 1) + '/' + nTotal + '</span>' +
                '<button class="cdt-min" onclick="window.DemoTour&&window.DemoTour.toggleMinimize()" ' +
                    'title="' + (_bMinimized ? "Expandir" : "Minimizar") + '">' + sMinIcon + '</button>' +
                '<button class="cdt-x" onclick="window.DemoTour&&window.DemoTour.close()" title="Salir">&#10005;</button>' +
            '</div>' +
            '<div class="cdt-panel-body" style="' + (_bMinimized ? 'display:none' : '') + '">' +
                '<div class="cdt-role-chip" style="color:' + oRole.color +
                    ';border-bottom:2px solid ' + oRole.color + '1a">' +
                    '<span style="width:9px;height:9px;border-radius:50%;background:' + oRole.color +
                        ';display:inline-block;margin-right:6px;vertical-align:middle"></span>' +
                    oRole.label +
                '</div>' +
                sList + sCard + sNav +
            '</div>';

        setTimeout(function () {
            var oActive = oPanel.querySelector(".cdt-item[style*='background:#f5f5f5']");
            if (oActive) { oActive.scrollIntoView({ block: "nearest" }); }
        }, 60);

        _initDrag(oPanel);
    }

    /* ── API pública ─────────────────────────────────────────────── */
    return {

        start: function (oRouter) {
            _oRouter    = oRouter;
            _aSteps     = _getCommonSteps();
            _nCurrent   = 0;
            _bMinimized = false;
            window.DemoTour = this;
            _createPanel();
            this._goTo(0);
        },

        _goTo: function (n) {
            _nCurrent = n;
            _bDragged = false;
            var oStep = _aSteps[n];

            if (oStep.onEnter) { oStep.onEnter(_oRouter); }

            _renderStep(n);

            /* Highlight con reintentos tras navegación */
            var nInitDelay = oStep.highlightDelay || (oStep.onEnter ? 400 : 50);
            setTimeout(function () {
                _highlightWithRetry(oStep.targetId, ROLES[oStep.role].color, 20, 150);
            }, nInitDelay);
        },

        _advance: function () {
            if (_nCurrent < _aSteps.length - 1) {
                this._goTo(_nCurrent + 1);
            } else {
                this.close();
            }
        },

        next: function () {
            var oStep = _aSteps[_nCurrent];
            var that  = this;
            if (!oStep) { return; }

            if (oStep.autoAction) {
                oStep.autoAction();
                if (!oStep.listenAction) {
                    var delay = oStep.autoDelay != null ? oStep.autoDelay : 0;
                    setTimeout(function () { that._advance(); }, delay);
                }
            } else {
                this._advance();
            }
        },

        prev: function () {
            if (_nCurrent > 0) { this._goTo(_nCurrent - 1); }
        },

        onUserAction: function (key) {
            var oStep = _aSteps && _aSteps[_nCurrent];
            if (!oStep || oStep.listenAction !== key) { return; }

            if (key === "abrirDetalle") {
                /* Detectar tipo y reconstruir pasos dinámicamente */
                var sDocType = window.DemoTourCurrentDocType || "CONTRATO";
                var sDocId   = window.DemoTourCurrentDocId   || "DOC-001";
                var sDocNum  = window.DemoTourCurrentDocNum  || "4500012345";
                _sDocType = sDocType;
                _sDocId   = sDocId;
                _sDocNum  = sDocNum;

                var aCommon = _getCommonSteps();
                var aTail   = (sDocType === "CONTRATO")
                    ? _buildContratoSteps(sDocId, sDocNum)
                    : _buildPosicionesSteps(sDocId, sDocNum, sDocType);
                _aSteps = aCommon.concat(aTail);
            }

            this._advance();
        },

        toggleMinimize: function () {
            _bMinimized = !_bMinimized;
            var oPanel = _getPanel();
            if (!oPanel) { return; }
            var oBody = oPanel.querySelector(".cdt-panel-body");
            if (oBody) { oBody.style.display = _bMinimized ? "none" : ""; }
            var oBtn  = oPanel.querySelector(".cdt-min");
            if (oBtn)  {
                oBtn.innerHTML = _bMinimized ? '&#9650;' : '&#9660;';
                oBtn.title     = _bMinimized ? "Expandir" : "Minimizar";
            }
        },

        close: function () {
            _clearHighlight();
            var p = _getPanel();
            if (p) { p.remove(); }
            window.DemoTour                    = null;
            window.DemoTourSimulateDemoXML     = null;
            window.DemoTourSelectAllPendientes  = null;
            window.DemoTourSelectFirstPosicion  = null;
            window.DemoTourSelectFirstConcepto  = null;
        }
    };
});
