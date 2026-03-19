sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/model/json/JSONModel"
], function (BaseObject, JSONModel) {
    "use strict";

    // Module-level shared store — survives across all new MockDataService() instances
    // because SAPUI5 loads each module only once and keeps it in memory.
    var _oSharedComprobantes = null;

    return BaseObject.extend("claro.com.clarocomprobantes.service.MockDataService", {
        
        constructor: function () {
            this._oDocumentosData = null;
            this._oContratosData = null;
            this._oObligacionesData = null;
            this._oOrdenesCompraData = null;
            this._oPolizasData = null;
            this._oUsuarioData = null;
            this._oProgramacionData = null;
            this._oPendientesFactData = null;
            this._oCuentasContablesData = null;
        },

        /**
         * Carga todos los datos mock desde los archivos JSON
         * @returns {Promise} Promesa que se resuelve cuando todos los datos están cargados
         */
        loadAllData: function () {
            var that = this;
            var sBasePath = sap.ui.require.toUrl("claro/com/clarocomprobantes/localService/mockdata");
            
            return Promise.all([
                this._loadJsonFile(sBasePath + "/documentos.json"),
                this._loadJsonFile(sBasePath + "/contratos.json"),
                this._loadJsonFile(sBasePath + "/obligaciones.json"),
                this._loadJsonFile(sBasePath + "/ordenesCompra.json"),
                this._loadJsonFile(sBasePath + "/polizas.json"),
                this._loadJsonFile(sBasePath + "/comprobantes.json"),
                this._loadJsonFile(sBasePath + "/usuario.json"),
                this._loadJsonFile(sBasePath + "/obligaciones_programacion.json"),
                this._loadJsonFile(sBasePath + "/pendientes_facturar.json"),
                this._loadJsonFile(sBasePath + "/cuentas_contables.json")
            ]).then(function (aResults) {
                that._oDocumentosData = aResults[0];
                that._oContratosData = aResults[1];
                that._oObligacionesData = aResults[2];
                that._oOrdenesCompraData = aResults[3];
                that._oPolizasData = aResults[4];
                // Use module-level shared store so comprobantes saved in any controller
                // are visible to all other controllers (singleton-like pattern).
                if (!_oSharedComprobantes) {
                    _oSharedComprobantes = aResults[5];
                }
                that._oUsuarioData = aResults[6];
                that._oProgramacionData = aResults[7];
                that._oPendientesFactData = aResults[8];
                that._oCuentasContablesData = aResults[9];
                return true;
            });
        },

        /**
         * Carga un archivo JSON
         * @param {string} sPath - Ruta del archivo
         * @returns {Promise} Promesa con los datos
         */
        _loadJsonFile: function (sPath) {
            return new Promise(function (resolve, reject) {
                jQuery.ajax({
                    url: sPath,
                    dataType: "json",
                    success: function (oData) {
                        resolve(oData);
                    },
                    error: function (oError) {
                        console.error("Error loading file: " + sPath, oError);
                        resolve({});
                    }
                });
            });
        },

        /**
         * Obtiene todos los documentos
         * @param {object} oFilters - Filtros opcionales
         * @returns {array} Lista de documentos
         */
        getDocumentos: function (oFilters) {
            var aDocumentos = this._oDocumentosData?.documentos || [];
            
            if (oFilters) {
                if (oFilters.tipoDocumento) {
                    aDocumentos = aDocumentos.filter(function (oDoc) {
                        return oDoc.tipoDocumento === oFilters.tipoDocumento;
                    });
                }
                if (oFilters.numeroDocumento) {
                    aDocumentos = aDocumentos.filter(function (oDoc) {
                        return oDoc.numeroDocumento.includes(oFilters.numeroDocumento);
                    });
                }
                if (oFilters.fechaDesde || oFilters.fechaHasta) {
                    aDocumentos = aDocumentos.filter(function (oDoc) {
                        var dFecha = new Date(oDoc.fechaDocumento);
                        if (oFilters.fechaDesde && dFecha < oFilters.fechaDesde) { return false; }
                        if (oFilters.fechaHasta && dFecha > oFilters.fechaHasta) { return false; }
                        return true;
                    });
                }
            }
            
            return aDocumentos;
        },

        /**
         * Obtiene un documento por ID
         * @param {string} sId - ID del documento
         * @returns {object} Documento
         */
        getDocumentoById: function (sId) {
            var aDocumentos = this._oDocumentosData?.documentos || [];
            return aDocumentos.find(function (oDoc) {
                return oDoc.id === sId;
            });
        },

        /**
         * Obtiene un contrato por número
         * @param {string} sNumeroContrato - Número del contrato
         * @returns {object} Contrato
         */
        getContratoByNumero: function (sNumeroContrato) {
            var aContratos = this._oContratosData?.contratos || [];
            return aContratos.find(function (oCont) {
                return oCont.numeroContrato === sNumeroContrato;
            });
        },

        /**
         * Obtiene los conceptos de un contrato
         * @param {string} sNumeroContrato - Número del contrato
         * @returns {array} Lista de conceptos
         */
        getConceptosByContrato: function (sNumeroContrato) {
            var oContrato = this.getContratoByNumero(sNumeroContrato);
            return oContrato?.conceptos || [];
        },

        /**
         * Obtiene las obligaciones por contrato y concepto
         * @param {string} sContratoId - ID del contrato
         * @param {string} sConceptoId - ID del concepto (opcional)
         * @param {string} sEstado - Estado (opcional)
         * @returns {array} Lista de obligaciones
         */
        getObligaciones: function (sContratoId, sConceptoId, sEstado) {
            var aObligaciones = this._oObligacionesData?.obligaciones || [];
            
            if (sContratoId) {
                aObligaciones = aObligaciones.filter(function (oObl) {
                    return oObl.contratoId === sContratoId;
                });
            }
            
            if (sConceptoId) {
                aObligaciones = aObligaciones.filter(function (oObl) {
                    return oObl.conceptoId === sConceptoId;
                });
            }
            
            if (sEstado) {
                aObligaciones = aObligaciones.filter(function (oObl) {
                    return oObl.estado === sEstado;
                });
            }
            
            return aObligaciones;
        },

        /**
         * Obtiene una orden de compra por número
         * @param {string} sNumeroOC - Número de la orden de compra
         * @returns {object} Orden de compra
         */
        getOrdenCompraByNumero: function (sNumeroOC) {
            var aOrdenes = this._oOrdenesCompraData?.ordenesCompra || [];
            return aOrdenes.find(function (oOC) {
                return oOC.numeroDocumento === sNumeroOC;
            });
        },

        /**
         * Obtiene las posiciones de una orden de compra
         * @param {string} sOrdenCompraId - ID de la orden de compra
         * @param {string} sEstado - Estado (opcional)
         * @returns {array} Lista de posiciones
         */
        getPosicionesOrdenCompra: function (sOrdenCompraId, sEstado) {
            var oOrden = this._oOrdenesCompraData?.ordenesCompra?.find(function (oOC) {
                return oOC.id === sOrdenCompraId;
            });
            
            var aPosiciones = oOrden?.posiciones || [];
            
            if (sEstado) {
                aPosiciones = aPosiciones.filter(function (oPos) {
                    return oPos.estado === sEstado;
                });
            }
            
            return aPosiciones;
        },

        /**
         * Obtiene una póliza por número
         * @param {string} sNumeroPoliza - Número de la póliza
         * @returns {object} Póliza
         */
        getPolizaByNumero: function (sNumeroPoliza) {
            var aPolizas = this._oPolizasData?.polizas || [];
            return aPolizas.find(function (oPol) {
                return oPol.numeroDocumento === sNumeroPoliza;
            });
        },

        /**
         * Obtiene la programación de obligaciones por contrato y concepto
         */
        getObligacionesProgramacion: function (sContratoId, sConceptoId) {
            var aData = this._oProgramacionData?.programacion || [];
            if (sContratoId) {
                aData = aData.filter(function (o) { return o.contratoId === sContratoId; });
            }
            if (sConceptoId) {
                aData = aData.filter(function (o) { return o.conceptoId === sConceptoId; });
            }
            return aData;
        },

        /**
         * Obtiene los pendientes por facturar por contrato y concepto
         */
        getPendientesFact: function (sContratoId, sConceptoId) {
            var aData = this._oPendientesFactData?.pendientesFact || [];
            if (sContratoId) {
                aData = aData.filter(function (o) { return o.contratoId === sContratoId; });
            }
            if (sConceptoId) {
                aData = aData.filter(function (o) { return o.conceptoId === sConceptoId; });
            }
            return aData;
        },

        /**
         * Obtiene el catálogo de cuentas contables
         */
        getCuentasContables: function () {
            return this._oCuentasContablesData?.cuentasContables || [];
        },

        /**
         * Obtiene las posiciones de una póliza
         * @param {string} sPolizaId - ID de la póliza
         * @param {string} sEstado - Estado (opcional)
         * @returns {array} Lista de posiciones
         */
        getPosicionesPoliza: function (sPolizaId, sEstado) {
            var oPoliza = this._oPolizasData?.polizas?.find(function (oPol) {
                return oPol.id === sPolizaId;
            });
            
            var aPosiciones = oPoliza?.posiciones || [];
            
            if (sEstado) {
                aPosiciones = aPosiciones.filter(function (oPos) {
                    return oPos.estado === sEstado;
                });
            }
            
            return aPosiciones;
        },

        /**
         * Obtiene los comprobantes
         * @param {object} oFilters - Filtros opcionales
         * @returns {array} Lista de comprobantes
         */
        getComprobantes: function (oFilters) {
            var aComprobantes = (_oSharedComprobantes || {comprobantes: []}).comprobantes || [];
            
            if (oFilters) {
                if (oFilters.estado) {
                    aComprobantes = aComprobantes.filter(function (oComp) {
                        return oComp.estado === oFilters.estado;
                    });
                }
            }
            
            return aComprobantes;
        },

        /**
         * Obtiene un comprobante por ID
         * @param {string} sId - ID del comprobante
         * @returns {object} Comprobante
         */
        getComprobanteById: function (sId) {
            var aComprobantes = (_oSharedComprobantes || {comprobantes: []}).comprobantes || [];
            return aComprobantes.find(function (oComp) {
                return oComp.id === sId;
            });
        },

        /**
         * Guarda un comprobante (simula persistencia)
         * @param {object} oComprobante - Datos del comprobante
         * @returns {object} Comprobante guardado
         */
        saveComprobante: function (oComprobante) {
            if (!_oSharedComprobantes) {
                _oSharedComprobantes = { comprobantes: [] };
            }
            
            var aComprobantes = _oSharedComprobantes.comprobantes;
            var iIndex = aComprobantes.findIndex(function (oComp) {
                return oComp.id === oComprobante.id;
            });
            
            if (iIndex >= 0) {
                aComprobantes[iIndex] = oComprobante;
            } else {
                oComprobante.id = "COMP-" + String(aComprobantes.length + 1).padStart(3, "0");
                aComprobantes.push(oComprobante);
            }
            
            return oComprobante;
        },

        /**
         * Obtiene los datos del usuario actual
         * @returns {object} Datos del usuario
         */
        getUsuarioActual: function () {
            return this._oUsuarioData?.usuario || null;
        },

        /**
         * Obtiene la configuración del sistema
         * @returns {object} Configuración
         */
        getConfiguracion: function () {
            return this._oUsuarioData?.configuracion || null;
        },

        /**
         * Valida el RUC del emisor contra el usuario
         * @param {string} sRucEmisor - RUC del emisor del XML
         * @returns {boolean} true si es válido
         */
        validarRucEmisor: function (sRucEmisor) {
            var oUsuario = this.getUsuarioActual();
            return oUsuario && oUsuario.ruc === sRucEmisor;
        },

        /**
         * Valida el RUC del receptor
         * @param {string} sRucReceptor - RUC del receptor del XML
         * @returns {boolean} true si es válido
         */
        validarRucReceptor: function (sRucReceptor) {
            var oConfig = this.getConfiguracion();
            return oConfig && oConfig.rucReceptor === sRucReceptor;
        }
    });
});
