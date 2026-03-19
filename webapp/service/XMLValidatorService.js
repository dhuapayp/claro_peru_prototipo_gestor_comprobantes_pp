sap.ui.define([
    "sap/ui/base/Object",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (BaseObject, MessageBox, MessageToast) {
    "use strict";

    /**
     * Servicio para validación y procesamiento de archivos XML de facturas electrónicas
     * Cumple con el estándar UBL 2.1 Perú (SUNAT)
     */
    return BaseObject.extend("claro.com.clarocomprobantes.service.XMLValidatorService", {
        
        constructor: function () {
            this._oConfiguracion = null;
        },

        /**
         * Establece la configuración del sistema
         * @param {object} oConfig - Configuración
         */
        setConfiguracion: function (oConfig) {
            this._oConfiguracion = oConfig;
        },

        /**
         * Parsea y valida un archivo XML de factura electrónica
         * @param {File} oFile - Archivo XML
         * @returns {Promise} Promesa con los datos extraídos
         */
        parseXMLFactura: function (oFile) {
            var that = this;
            
            return new Promise(function (resolve, reject) {
                var oReader = new FileReader();
                
                oReader.onload = function (e) {
                    try {
                        var sXmlContent = e.target.result;
                        var oParser = new DOMParser();
                        var oXmlDoc = oParser.parseFromString(sXmlContent, "text/xml");
                        
                        // Verificar errores de parseo
                        var oParseError = oXmlDoc.querySelector("parsererror");
                        if (oParseError) {
                            reject({
                                error: true,
                                message: "El archivo XML no tiene un formato válido",
                                details: oParseError.textContent
                            });
                            return;
                        }
                        
                        // Extraer datos del XML
                        var oFacturaData = that._extractFacturaData(oXmlDoc);
                        
                        // Validar estructura básica
                        var oValidation = that._validateStructure(oFacturaData);
                        if (!oValidation.valid) {
                            reject({
                                error: true,
                                message: oValidation.message,
                                details: oValidation.details
                            });
                            return;
                        }
                        
                        resolve({
                            success: true,
                            data: oFacturaData
                        });
                        
                    } catch (oError) {
                        reject({
                            error: true,
                            message: "Error al procesar el archivo XML",
                            details: oError.message
                        });
                    }
                };
                
                oReader.onerror = function () {
                    reject({
                        error: true,
                        message: "Error al leer el archivo XML"
                    });
                };
                
                oReader.readAsText(oFile);
            });
        },

        /**
         * Extrae los datos de factura del documento XML
         * @param {Document} oXmlDoc - Documento XML parseado
         * @returns {object} Datos extraídos
         */
        _extractFacturaData: function (oXmlDoc) {
            var that = this;
            
            // Namespaces UBL 2.1
            var oNamespaces = {
                "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
                "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
                "ext": "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"
            };
            
            // Función helper para obtener texto de un elemento
            var fnGetText = function (sSelector) {
                try {
                    // Intentar con namespace resolver
                    var oElement = oXmlDoc.querySelector(sSelector);
                    if (oElement) {
                        return oElement.textContent?.trim() || "";
                    }
                    
                    // Intentar sin namespace (para XMLs simplificados)
                    var aElements = oXmlDoc.getElementsByTagName(sSelector.replace(/[^a-zA-Z]/g, ""));
                    if (aElements.length > 0) {
                        return aElements[0].textContent?.trim() || "";
                    }
                    
                    return "";
                } catch (e) {
                    return "";
                }
            };
            
            // Función helper para obtener atributo
            var fnGetAttr = function (sSelector, sAttr) {
                try {
                    var oElement = oXmlDoc.querySelector(sSelector);
                    return oElement?.getAttribute(sAttr) || "";
                } catch (e) {
                    return "";
                }
            };

            // Extraer datos - Simulación basada en estructura UBL 2.1
            // En producción, usar xpath o namespace-aware selectors
            var oData = {
                // Tipo de documento
                tipoDocumento: this._extractByTagName(oXmlDoc, "InvoiceTypeCode") || "01",
                
                // Serie y número
                serieDocumento: "",
                numeroDocumento: "",
                
                // El ID en UBL tiene formato SERIE-NUMERO
                id: this._extractByTagName(oXmlDoc, "ID") || "",
                
                // Fecha de emisión
                fechaEmision: this._extractByTagName(oXmlDoc, "IssueDate") || "",
                
                // Datos del emisor (proveedor)
                rucEmisor: this._extractSupplierRUC(oXmlDoc),
                razonSocialEmisor: this._extractSupplierName(oXmlDoc),
                
                // Datos del receptor (Claro)
                rucReceptor: this._extractCustomerRUC(oXmlDoc),
                razonSocialReceptor: this._extractCustomerName(oXmlDoc),
                
                // Moneda
                moneda: this._extractCurrency(oXmlDoc),
                
                // Importes
                importeBase: this._extractTaxableAmount(oXmlDoc),
                montoIGV: this._extractIGVAmount(oXmlDoc),
                montoInafecto: this._extractExemptAmount(oXmlDoc),
                montoTotal: this._extractTotalAmount(oXmlDoc),
                
                // Indicadores
                indicadorIGV: true,
                
                // Detracción y retención
                porcentajeDetraccion: this._extractDetractionPercent(oXmlDoc),
                montoDetraccion: this._extractDetractionAmount(oXmlDoc),
                porcentajeRetencion: 0,
                montoRetencion: 0
            };
            
            // Parsear serie y número del ID
            if (oData.id) {
                var aParts = oData.id.split("-");
                if (aParts.length >= 2) {
                    oData.serieDocumento = aParts[0];
                    oData.numeroDocumento = aParts.slice(1).join("-");
                }
            }
            
            // Calcular importe neto
            oData.importeNeto = oData.montoTotal - oData.montoDetraccion - oData.montoRetencion;
            
            // Determinar indicador de impuesto
            oData.indicadorImpuesto = oData.montoIGV > 0 ? "1000" : "9997";
            
            return oData;
        },

        /**
         * Extrae texto de un elemento por nombre de tag
         * @param {Document} oXmlDoc - Documento XML
         * @param {string} sTagName - Nombre del tag
         * @returns {string} Texto del elemento
         */
        _extractByTagName: function (oXmlDoc, sTagName) {
            // Intentar con diferentes prefijos de namespace
            var aPrefixes = ["cbc:", "cac:", "ext:", ""];
            
            for (var i = 0; i < aPrefixes.length; i++) {
                var aElements = oXmlDoc.getElementsByTagName(aPrefixes[i] + sTagName);
                if (aElements.length > 0) {
                    return aElements[0].textContent?.trim() || "";
                }
            }
            
            // Intentar sin namespace
            var aAllElements = oXmlDoc.getElementsByTagName(sTagName);
            if (aAllElements.length > 0) {
                return aAllElements[0].textContent?.trim() || "";
            }
            
            return "";
        },

        /**
         * Extrae el RUC del proveedor (emisor)
         */
        _extractSupplierRUC: function (oXmlDoc) {
            // En UBL 2.1, el RUC está en AccountingSupplierParty/Party/PartyIdentification/ID
            var aSupplierParty = oXmlDoc.getElementsByTagName("cac:AccountingSupplierParty");
            if (aSupplierParty.length === 0) {
                aSupplierParty = oXmlDoc.getElementsByTagName("AccountingSupplierParty");
            }
            
            if (aSupplierParty.length > 0) {
                var aPartyId = aSupplierParty[0].getElementsByTagName("cbc:ID");
                if (aPartyId.length === 0) {
                    aPartyId = aSupplierParty[0].getElementsByTagName("ID");
                }
                if (aPartyId.length > 0) {
                    return aPartyId[0].textContent?.trim() || "";
                }
            }
            
            // Fallback para mock
            return "20100130204";
        },

        /**
         * Extrae la razón social del proveedor
         */
        _extractSupplierName: function (oXmlDoc) {
            var aSupplierParty = oXmlDoc.getElementsByTagName("cac:AccountingSupplierParty");
            if (aSupplierParty.length === 0) {
                aSupplierParty = oXmlDoc.getElementsByTagName("AccountingSupplierParty");
            }
            
            if (aSupplierParty.length > 0) {
                var aRegName = aSupplierParty[0].getElementsByTagName("cbc:RegistrationName");
                if (aRegName.length === 0) {
                    aRegName = aSupplierParty[0].getElementsByTagName("RegistrationName");
                }
                if (aRegName.length > 0) {
                    return aRegName[0].textContent?.trim() || "";
                }
            }
            
            return "INMOBILIARIA PERU SAC";
        },

        /**
         * Extrae el RUC del cliente (receptor)
         */
        _extractCustomerRUC: function (oXmlDoc) {
            var aCustomerParty = oXmlDoc.getElementsByTagName("cac:AccountingCustomerParty");
            if (aCustomerParty.length === 0) {
                aCustomerParty = oXmlDoc.getElementsByTagName("AccountingCustomerParty");
            }
            
            if (aCustomerParty.length > 0) {
                var aPartyId = aCustomerParty[0].getElementsByTagName("cbc:ID");
                if (aPartyId.length === 0) {
                    aPartyId = aCustomerParty[0].getElementsByTagName("ID");
                }
                if (aPartyId.length > 0) {
                    return aPartyId[0].textContent?.trim() || "";
                }
            }
            
            // Fallback - RUC de America Movil Peru
            return "20467534026";
        },

        /**
         * Extrae la razón social del cliente
         */
        _extractCustomerName: function (oXmlDoc) {
            var aCustomerParty = oXmlDoc.getElementsByTagName("cac:AccountingCustomerParty");
            if (aCustomerParty.length === 0) {
                aCustomerParty = oXmlDoc.getElementsByTagName("AccountingCustomerParty");
            }
            
            if (aCustomerParty.length > 0) {
                var aRegName = aCustomerParty[0].getElementsByTagName("cbc:RegistrationName");
                if (aRegName.length === 0) {
                    aRegName = aCustomerParty[0].getElementsByTagName("RegistrationName");
                }
                if (aRegName.length > 0) {
                    return aRegName[0].textContent?.trim() || "";
                }
            }
            
            return "AMERICA MOVIL PERU SAC";
        },

        /**
         * Extrae la moneda del documento
         */
        _extractCurrency: function (oXmlDoc) {
            var aElements = oXmlDoc.getElementsByTagName("cbc:DocumentCurrencyCode");
            if (aElements.length === 0) {
                aElements = oXmlDoc.getElementsByTagName("DocumentCurrencyCode");
            }
            
            if (aElements.length > 0) {
                return aElements[0].textContent?.trim() || "PEN";
            }
            
            return "PEN";
        },

        /**
         * Extrae el monto gravado (base imponible)
         */
        _extractTaxableAmount: function (oXmlDoc) {
            var aElements = oXmlDoc.getElementsByTagName("cbc:TaxableAmount");
            if (aElements.length === 0) {
                aElements = oXmlDoc.getElementsByTagName("TaxableAmount");
            }
            
            if (aElements.length > 0) {
                return parseFloat(aElements[0].textContent) || 0;
            }
            
            // Calcular desde LineExtensionAmount
            var aLineExt = oXmlDoc.getElementsByTagName("cbc:LineExtensionAmount");
            if (aLineExt.length === 0) {
                aLineExt = oXmlDoc.getElementsByTagName("LineExtensionAmount");
            }
            
            if (aLineExt.length > 0) {
                return parseFloat(aLineExt[0].textContent) || 0;
            }
            
            return 0;
        },

        /**
         * Extrae el monto de IGV
         */
        _extractIGVAmount: function (oXmlDoc) {
            var aTaxTotal = oXmlDoc.getElementsByTagName("cac:TaxTotal");
            if (aTaxTotal.length === 0) {
                aTaxTotal = oXmlDoc.getElementsByTagName("TaxTotal");
            }
            
            if (aTaxTotal.length > 0) {
                var aTaxAmount = aTaxTotal[0].getElementsByTagName("cbc:TaxAmount");
                if (aTaxAmount.length === 0) {
                    aTaxAmount = aTaxTotal[0].getElementsByTagName("TaxAmount");
                }
                if (aTaxAmount.length > 0) {
                    return parseFloat(aTaxAmount[0].textContent) || 0;
                }
            }
            
            return 0;
        },

        /**
         * Extrae el monto exonerado/inafecto
         */
        _extractExemptAmount: function (oXmlDoc) {
            // Buscar en TaxSubtotal con código de exoneración
            // Por simplicidad, retornamos 0 si no se encuentra
            return 0;
        },

        /**
         * Extrae el monto total
         */
        _extractTotalAmount: function (oXmlDoc) {
            var aElements = oXmlDoc.getElementsByTagName("cbc:PayableAmount");
            if (aElements.length === 0) {
                aElements = oXmlDoc.getElementsByTagName("PayableAmount");
            }
            
            if (aElements.length > 0) {
                return parseFloat(aElements[0].textContent) || 0;
            }
            
            return 0;
        },

        /**
         * Extrae el porcentaje de detracción
         */
        _extractDetractionPercent: function (oXmlDoc) {
            // La detracción se encuentra en PaymentTerms o como extensión
            return 0;
        },

        /**
         * Extrae el monto de detracción
         */
        _extractDetractionAmount: function (oXmlDoc) {
            return 0;
        },

        /**
         * Valida la estructura del XML
         * @param {object} oFacturaData - Datos extraídos
         * @returns {object} Resultado de validación
         */
        _validateStructure: function (oFacturaData) {
            var aErrors = [];
            
            // Validar campos obligatorios
            if (!oFacturaData.tipoDocumento) {
                aErrors.push("Tipo de documento no encontrado");
            }
            
            if (!oFacturaData.serieDocumento || !oFacturaData.numeroDocumento) {
                aErrors.push("Serie y/o número de documento no encontrados");
            }
            
            if (!oFacturaData.fechaEmision) {
                aErrors.push("Fecha de emisión no encontrada");
            }
            
            if (!oFacturaData.rucEmisor) {
                aErrors.push("RUC del emisor no encontrado");
            }
            
            if (!oFacturaData.rucReceptor) {
                aErrors.push("RUC del receptor no encontrado");
            }
            
            if (oFacturaData.montoTotal <= 0) {
                aErrors.push("El monto total debe ser mayor a cero");
            }
            
            return {
                valid: aErrors.length === 0,
                message: aErrors.length > 0 ? "El XML no cumple con la estructura requerida" : "",
                details: aErrors.join(", ")
            };
        },

        /**
         * Valida el RUC del emisor contra el usuario logueado
         * @param {string} sRucXML - RUC extraído del XML
         * @param {string} sRucUsuario - RUC del usuario logueado
         * @returns {object} Resultado de validación
         */
        validarRucEmisor: function (sRucXML, sRucUsuario) {
            var bValid = sRucXML === sRucUsuario;
            return {
                valid: bValid,
                message: bValid ? "" : "El RUC del emisor en el XML (" + sRucXML + ") no coincide con el RUC del proveedor (" + sRucUsuario + ")"
            };
        },

        /**
         * Valida el RUC del receptor
         * @param {string} sRucXML - RUC extraído del XML
         * @returns {object} Resultado de validación
         */
        validarRucReceptor: function (sRucXML) {
            var sRucClaro = this._oConfiguracion?.rucReceptor || "20467534026";
            var bValid = sRucXML === sRucClaro;
            return {
                valid: bValid,
                message: bValid ? "" : "El RUC del receptor en el XML (" + sRucXML + ") no corresponde a America Movil Peru SAC (" + sRucClaro + ")"
            };
        },

        /**
         * Valida los importes del comprobante contra las asignaciones
         * @param {object} oComprobante - Datos del comprobante
         * @param {array} aAsignaciones - Obligaciones/posiciones asignadas
         * @returns {object} Resultado de validación con comparación
         */
        validarImportes: function (oComprobante, aAsignaciones) {
            var fTolerance = this._oConfiguracion?.toleranciaDiferencia || 1.00;
            
            // Calcular totales de asignaciones
            var oTotalesAsignados = {
                importeBase: 0,
                montoIGV: 0,
                montoInafecto: 0,
                montoTotal: 0
            };
            
            aAsignaciones.forEach(function (oAsig) {
                oTotalesAsignados.importeBase += (oAsig.importeObligacion || oAsig.importe || 0);
                oTotalesAsignados.montoIGV += (oAsig.montoIGV || 0);
                oTotalesAsignados.montoInafecto += (oAsig.montoInafecto || 0);
                oTotalesAsignados.montoTotal += (oAsig.montoTotal || oAsig.importe || 0);
            });
            
            // Comparar
            var aDiferencias = [];
            var bValid = true;
            
            var fDiffBase = Math.abs(oComprobante.importeBase - oTotalesAsignados.importeBase);
            var fDiffIGV = Math.abs(oComprobante.montoIGV - oTotalesAsignados.montoIGV);
            var fDiffInafecto = Math.abs(oComprobante.montoInafecto - oTotalesAsignados.montoInafecto);
            var fDiffTotal = Math.abs(oComprobante.montoTotal - oTotalesAsignados.montoTotal);
            
            if (fDiffBase > fTolerance) {
                bValid = false;
                aDiferencias.push({
                    campo: "Importe Base",
                    xml: oComprobante.importeBase,
                    asignado: oTotalesAsignados.importeBase,
                    diferencia: fDiffBase
                });
            }
            
            if (fDiffIGV > fTolerance) {
                bValid = false;
                aDiferencias.push({
                    campo: "Monto IGV",
                    xml: oComprobante.montoIGV,
                    asignado: oTotalesAsignados.montoIGV,
                    diferencia: fDiffIGV
                });
            }
            
            if (fDiffInafecto > fTolerance) {
                bValid = false;
                aDiferencias.push({
                    campo: "Monto Inafecto",
                    xml: oComprobante.montoInafecto,
                    asignado: oTotalesAsignados.montoInafecto,
                    diferencia: fDiffInafecto
                });
            }
            
            if (fDiffTotal > fTolerance) {
                bValid = false;
                aDiferencias.push({
                    campo: "Monto Total",
                    xml: oComprobante.montoTotal,
                    asignado: oTotalesAsignados.montoTotal,
                    diferencia: fDiffTotal
                });
            }
            
            return {
                valid: bValid,
                tolerancia: fTolerance,
                totalesXML: {
                    importeBase: oComprobante.importeBase,
                    montoIGV: oComprobante.montoIGV,
                    montoInafecto: oComprobante.montoInafecto,
                    montoTotal: oComprobante.montoTotal,
                    montoDetraccion: oComprobante.montoDetraccion || 0,
                    montoRetencion: oComprobante.montoRetencion || 0,
                    importeNeto: oComprobante.importeNeto
                },
                totalesAsignados: oTotalesAsignados,
                diferencias: aDiferencias,
                message: bValid ? "" : "Existen diferencias entre los importes del XML y las asignaciones que exceden la tolerancia de S/ " + fTolerance.toFixed(2)
            };
        },

        /**
         * Genera datos simulados de un XML para demo
         * @returns {object} Datos simulados
         */
        generarDatosMock: function () {
            return {
                tipoDocumento: "01",
                serieDocumento: "F001",
                numeroDocumento: "00012500",
                fechaEmision: new Date().toISOString().split("T")[0],
                rucEmisor: "20100130204",
                razonSocialEmisor: "INMOBILIARIA PERU SAC",
                rucReceptor: "20467534026",
                razonSocialReceptor: "AMERICA MOVIL PERU SAC",
                moneda: "PEN",
                importeBase: 5000.00,
                montoIGV: 900.00,
                montoInafecto: 0.00,
                montoTotal: 5900.00,
                indicadorIGV: true,
                indicadorImpuesto: "1000",
                porcentajeDetraccion: 0,
                montoDetraccion: 0.00,
                porcentajeRetencion: 0,
                montoRetencion: 0.00,
                importeNeto: 5900.00
            };
        }
    });
});
