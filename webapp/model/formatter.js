sap.ui.define([
    "sap/ui/core/format/DateFormat",
    "sap/ui/core/format/NumberFormat"
], function (DateFormat, NumberFormat) {
    "use strict";

    var oDateFormat = DateFormat.getDateInstance({
        pattern: "dd/MM/yyyy"
    });
    
    var oDateTimeFormat = DateFormat.getDateTimeInstance({
        pattern: "dd/MM/yyyy HH:mm"
    });
    
    var oCurrencyFormat = NumberFormat.getCurrencyInstance({
        currencyCode: false,
        decimals: 2
    });

    var fnFormatDate = function (vDate) {
        if (!vDate) { return ""; }
        var oDate = (typeof vDate === "string") ? new Date(vDate) : vDate;
        return isNaN(oDate.getTime()) ? vDate : oDateFormat.format(oDate);
    };

    return {
        /**
         * Formatea una fecha al formato dd/MM/yyyy
         * @param {string|Date} vDate - Fecha a formatear
         * @returns {string} Fecha formateada
         */
        formatDate: function (vDate) {
            return fnFormatDate(vDate);
        },

        /**
         * Formatea una fecha y hora al formato dd/MM/yyyy HH:mm
         * @param {string|Date} vDateTime - Fecha y hora a formatear
         * @returns {string} Fecha y hora formateada
         */
        formatDateTime: function (vDateTime) {
            if (!vDateTime) {
                return "";
            }
            
            var oDate = vDateTime;
            if (typeof vDateTime === "string") {
                oDate = new Date(vDateTime);
            }
            
            if (isNaN(oDate.getTime())) {
                return vDateTime;
            }
            
            return oDateTimeFormat.format(oDate);
        },

        formatDateRange: function (vStart, vEnd) {
            var sStart = fnFormatDate(vStart);
            var sEnd = fnFormatDate(vEnd);
            if (!sStart && !sEnd) { return ""; }
            return sStart + " – " + sEnd;
        },

        /**
         * Formatea un número como moneda
         * @param {number} fValue - Valor numérico
         * @returns {string} Valor formateado
         */
        formatCurrency: function (fValue) {
            if (fValue === null || fValue === undefined) {
                return "0.00";
            }
            
            return oCurrencyFormat.format(fValue);
        },

        formatCurrencyNullable: function (fValue) {
            if (fValue === null || fValue === undefined || fValue === "") {
                return "—";
            }
            return oCurrencyFormat.format(fValue);
        },

        /**
         * Highlight color for programación row based on payment status
         */
        formatProgramacionHighlight: function (fImportePagado) {
            if (fImportePagado === null || fImportePagado === undefined || fImportePagado === "") {
                return "Error";   // rojo — sin pago
            }
            // We need importeProgramado too; this formatter receives only one value binding.
            // The row context stores importeProgramado so we use a parts binding in the view.
            // This function is called via the two-part binding version below.
            return "Success";
        },

        formatProgramacionHighlightFull: function (fImporteProgramado, fImportePagado) {
            if (fImportePagado === null || fImportePagado === undefined || fImportePagado === "") {
                return "Error";      // rojo — sin pago
            }
            var fProg = parseFloat(fImporteProgramado) || 0;
            var fPago = parseFloat(fImportePagado) || 0;
            if (fPago >= fProg) {
                return "Success";    // verde — pagado completo
            }
            if (fPago > 0) {
                return "Warning";   // naranja — pago parcial
            }
            return "Error";         // rojo — sin pago
        },

        /**
         * Formatea un número con decimales
         * @param {number} fValue - Valor numérico
         * @param {number} iDecimals - Número de decimales
         * @returns {string} Valor formateado
         */
        formatNumber: function (fValue, iDecimals) {
            if (fValue === null || fValue === undefined) {
                return "0";
            }
            
            var oNumberFormat = NumberFormat.getFloatInstance({
                decimals: iDecimals || 2
            });
            
            return oNumberFormat.format(fValue);
        },

        /**
         * Retorna el estado visual según el código de estado
         * @param {string} sEstado - Código de estado
         * @returns {string} Estado para ObjectStatus
         */
        formatEstadoState: function (sEstado) {
            switch (sEstado) {
                case "VIGENTE":
                case "ENVIADO":
                case "FACTURADO":
                    return "Success";
                case "PARCIAL":
                case "REGISTRADO":
                case "PENDIENTE":
                    return "Warning";
                case "VENCIDO":
                case "ANULADO":
                    return "Error";
                default:
                    return "None";
            }
        },

        /**
         * Retorna el icono según el código de estado
         * @param {string} sEstado - Código de estado
         * @returns {string} URI del icono
         */
        formatEstadoIcon: function (sEstado) {
            switch (sEstado) {
                case "VIGENTE":
                case "ENVIADO":
                    return "sap-icon://accept";
                case "PARCIAL":
                case "REGISTRADO":
                    return "sap-icon://pending";
                case "PENDIENTE":
                    return "sap-icon://status-in-process";
                case "VENCIDO":
                case "ANULADO":
                    return "sap-icon://decline";
                default:
                    return "sap-icon://question-mark";
            }
        },

        formatTipoDocumentoIcon: function (sTipo) {
            switch (sTipo) {
                case "CONTRATO": return "sap-icon://document-text";
                case "OC": return "sap-icon://cart";
                case "POLIZA": return "sap-icon://shield";
                case "Póliza": return "sap-icon://shield";
                default: return "sap-icon://document";
            }
        },

        formatConceptoTipo: function (sCodigo) {
            var aArrendamiento = ["ALQ", "GC", "IND", "EQP", "SUM"];
            var aMantenimiento = ["MPR", "MCO", "MAN", "LMP", "DES", "INS", "REP", "EME"];
            var aSeguridad     = ["VIG", "MON", "RON", "INF", "CUS", "SEG"];
            if (aArrendamiento.indexOf(sCodigo) >= 0) return "Information";
            if (aMantenimiento.indexOf(sCodigo) >= 0) return "Success";
            if (aSeguridad.indexOf(sCodigo) >= 0)     return "Warning";
            return "Indication06";
        },

        formatConceptoValueState: function (sCodigo) {
            var aArrendamiento = ["ALQ", "GC", "IND", "EQP", "SUM"];
            var aMantenimiento = ["MPR", "MCO", "MAN", "LMP", "DES", "INS", "REP", "EME"];
            var aSeguridad     = ["VIG", "MON", "RON", "INF", "CUS", "SEG"];
            if (aArrendamiento.indexOf(sCodigo) >= 0) return "Information";
            if (aMantenimiento.indexOf(sCodigo) >= 0) return "Success";
            if (aSeguridad.indexOf(sCodigo) >= 0)     return "Warning";
            return "None";
        },

        formatConceptoIcon: function (sCodigo) {
            var aArrendamiento = ["ALQ", "GC", "IND", "EQP", "SUM"];
            var aMantenimiento = ["MPR", "MCO", "MAN", "LMP", "DES", "INS", "REP", "EME"];
            var aSeguridad     = ["VIG", "MON", "RON", "INF", "CUS", "SEG"];
            if (aArrendamiento.indexOf(sCodigo) >= 0) return "sap-icon://home";
            if (aMantenimiento.indexOf(sCodigo) >= 0) return "sap-icon://wrench";
            if (aSeguridad.indexOf(sCodigo) >= 0)     return "sap-icon://shield";
            return "sap-icon://task";
        },

        /**
         * Formatea el tipo de documento de pago
         * @param {string} sTipo - Código del tipo
         * @returns {string} Descripción del tipo
         */
        formatTipoDocPago: function (sTipo) {
            switch (sTipo) {
                case "01":
                    return "Factura";
                case "07":
                    return "Nota de Crédito";
                case "08":
                    return "Nota de Débito";
                default:
                    return sTipo;
            }
        },

        /**
         * Formatea la moneda con su símbolo
         * @param {string} sMoneda - Código de moneda
         * @returns {string} Símbolo de moneda
         */
        formatMonedaSimbolo: function (sMoneda) {
            switch (sMoneda) {
                case "PEN":
                    return "S/";
                case "USD":
                    return "$";
                case "EUR":
                    return "€";
                default:
                    return sMoneda;
            }
        },

        /**
         * Calcula el porcentaje de consumo
         * @param {number} fPagado - Monto pagado
         * @param {number} fTotal - Monto total
         * @returns {string} Porcentaje formateado
         */
        formatPorcentajeConsumo: function (fPagado, fTotal) {
            if (!fTotal || fTotal === 0) {
                return "0%";
            }
            
            var fPorcentaje = (fPagado / fTotal) * 100;
            return fPorcentaje.toFixed(1) + "%";
        },

        /**
         * Determina si un comprobante es editable según su estado
         * @param {string} sEstado - Estado del comprobante
         * @returns {boolean} true si es editable
         */
        isEditable: function (sEstado) {
            return sEstado === "REGISTRADO";
        },

        /**
         * Determina la visibilidad del botón enviar
         * @param {string} sEstado - Estado del comprobante
         * @returns {boolean} true si se puede enviar
         */
        canSend: function (sEstado) {
            return sEstado === "REGISTRADO";
        },

        /**
         * Formatea el RUC con guiones
         * @param {string} sRuc - RUC sin formato
         * @returns {string} RUC formateado
         */
        formatRuc: function (sRuc) {
            if (!sRuc || sRuc.length !== 11) {
                return sRuc;
            }
            
            return sRuc.substring(0, 2) + "-" + sRuc.substring(2);
        },

        /**
         * Retorna la clase CSS según el estado
         * @param {string} sEstado - Código de estado
         * @returns {string} Clase CSS
         */
        getEstadoClass: function (sEstado) {
            switch (sEstado) {
                case "VIGENTE":
                case "ENVIADO":
                    return "sapUiTinyMarginBegin greenText";
                case "PARCIAL":
                case "REGISTRADO":
                    return "sapUiTinyMarginBegin orangeText";
                case "PENDIENTE":
                    return "sapUiTinyMarginBegin blueText";
                default:
                    return "";
            }
        }
    };
});
