sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "claro/com/clarocomprobantes/service/MockDataService",
    "claro/com/clarocomprobantes/service/XMLValidatorService",
    "claro/com/clarocomprobantes/model/formatter",
    "sap/ui/Device"
], function (Controller, JSONModel, MessageBox, MessageToast, MockDataService, XMLValidatorService, formatter, Device) {
    "use strict";

    return Controller.extend("claro.com.clarocomprobantes.controller.RegisterVoucher", {
        
        formatter: formatter,
        
        /**
         * Formatter para texto de tolerancia
         */
        formatToleranciaText: function(fDiferencia, sExcede, sOk) {
            if (Math.abs(fDiferencia) > 1) {
                return sExcede;
            }
            return sOk;
        },
        
        onInit: function () {
            // Inicializar servicios
            this._oMockDataService = new MockDataService();
            this._oXMLValidatorService = new XMLValidatorService();
            
            // Modelo de vista
            var oViewModel = new JSONModel({
                busy: false,
                mode: "new",
                readOnly: false,
                pageTitle: "Registrar Comprobante",
                step1Valid: false,
                step2Valid: false,
                step3Valid: false,
                step4Valid: false,
                canRegister: false,
                canSubmit: false,
                xmlLoaded: false,
                xmlFileName: "",
                pdfLoaded: false,
                pdfFileName: "",
                cdrLoaded: false,
                cdrFileName: "",
                otrosArchivos: [],
                rucEmisorValid: false,
                rucReceptorValid: false,
                selectedConceptoId: "",
                hasSelectedObligaciones: false,
                hasSelectedPosiciones: false,
                countSelectedPosiciones: 0,
                hasSelectedPendientes: false,
                posicionesPage: 1,
                posicionesTotalPages: 1,
                posicionesTotal: 0,
                registrationComplete: false,
                asignaciones: [],
                totalAsignado: 0,
                asignacionesCount: 0,
                validacionOk: false,
                validacionMessage: "",
                comparacion: [],
                isPhone: window.innerWidth < 600,
                progMobilePage: 1,
                progMobileTotalPages: 1,
                progMobileTotal: 0,
                progMobilePrevEnabled: false,
                progMobileNextEnabled: false,
                progMobilePageInfo: "Pag 1 de 1 | 0 Reg.",
                pendMobilePage: 1,
                pendMobileTotalPages: 1,
                pendMobileTotal: 0,
                pendMobilePrevEnabled: false,
                pendMobileNextEnabled: false,
                pendMobilePageInfo: "Pag 1 de 1 | 0 Reg.",
                posMobilePage: 1,
                posMobileTotalPages: 1,
                posMobileTotal: 0,
                posMobilePrevEnabled: false,
                posMobileNextEnabled: false,
                posMobilePageInfo: "Pag 1 de 1 | 0 Reg."
            });
            this.getView().setModel(oViewModel, "viewModel");

            // Listener nativo resize: reactivo en Chrome DevTools y dispositivos reales
            var that0 = this;
            this._fnResizeHandler = function () {
                var bPhone = window.innerWidth < 600;
                var oVM = that0.getView() && that0.getView().getModel("viewModel");
                if (oVM) { oVM.setProperty("/isPhone", bPhone); }
            };
            window.addEventListener("resize", this._fnResizeHandler);

            // Modelo del detalle del documento origen
            var oDetalleModel = new JSONModel({});
            this.getView().setModel(oDetalleModel, "detalle");
            
            // Modelo del contrato
            var oContratoModel = new JSONModel({});
            this.getView().setModel(oContratoModel, "contrato");
            
            // Modelo de obligaciones
            var oObligacionesModel = new JSONModel([]);
            this.getView().setModel(oObligacionesModel, "obligaciones");

            // Modelo de programación de obligaciones (Tabla 1 Paso 3)
            var oProgramacionModel = new JSONModel([]);
            this.getView().setModel(oProgramacionModel, "programacion");

            // Modelo de pendientes por facturar (Tabla 2 Paso 3)
            var oPendientesFactModel = new JSONModel([]);
            this.getView().setModel(oPendientesFactModel, "pendientesFact");

            // Modelos paginados para listas mobile (Paso 3 Contrato)
            this.getView().setModel(new JSONModel([]), "programacionPaged");
            this.getView().setModel(new JSONModel([]), "pendientesFactPaged");
            this.getView().setModel(new JSONModel([]), "posicionesPaged");
            this.getView().setModel(new JSONModel([]), "searchResults");
            this.getView().setModel(new JSONModel([]), "searchResultsPaged");
            this._allSearchResults = [];
            this._iSearchPageSize = 10;
            this._iMobilePageSize = 3;
            this._iPosMobilePageSize = 5;

            // Modelo de cuentas contables (para Value Help)
            var oCuentasContablesModel = new JSONModel([]);
            this.getView().setModel(oCuentasContablesModel, "cuentasContables");
            
            // Modelo de posiciones
            var oPosicionesModel = new JSONModel([]);
            this.getView().setModel(oPosicionesModel, "posiciones");
            
            // Modelo del comprobante
            var oComprobanteModel = new JSONModel({
                tipoFactura: "ELECTRONICO",
                tipoDocumento: "",
                serieDocumento: "",
                numeroDocumento: "",
                fechaEmision: "",
                fechaRecepcion: new Date().toISOString().split("T")[0],
                rucEmisor: "",
                razonSocialEmisor: "",
                rucReceptor: "",
                razonSocialReceptor: "",
                moneda: "PEN",
                importeBase: 0,
                montoIGV: 0,
                montoInafecto: 0,
                montoTotal: 0,
                indicadorIGV: true,
                indicadorImpuesto: "1000",
                porcentajeDetraccion: 0,
                montoDetraccion: 0,
                porcentajeRetencion: 0,
                montoRetencion: 0,
                importeNeto: 0,
                periodoMes: new Date().getMonth() + 1,
                periodoAnio: new Date().getFullYear(),
                estado: "REGISTRADO"
            });
            this.getView().setModel(oComprobanteModel, "comprobante");
            
            // Router
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteRegisterVoucher").attachPatternMatched(this._onNewVoucherMatched, this);
            oRouter.getRoute("RouteRegisterVoucherForDoc").attachPatternMatched(this._onRegisterForDocMatched, this);
            oRouter.getRoute("RouteVoucherDetail").attachPatternMatched(this._onVoucherDetailMatched, this);
        },
        
        _onNewVoucherMatched: function (oEvent) {
            // Skip reset if returning from document detail (preserve wizard state)
            if (this._bPreserveState) {
                this._bPreserveState = false;
                return;
            }
            this._sDocumentId = null;
            this._sTipoDocumento = null;
            this._sNumeroDocumento = null;
            this._sComprobanteId = null;
            this._sMode = "new";
            this._resetState();
            this._loadData();

            // Publish demo helpers for DemoTourService
            var that2 = this;

            // Simula la carga del XML con datos adaptados al tipo de documento
            window.DemoTourSimulateDemoXML = function () {
                var oComprobanteModel = that2.getView().getModel("comprobante");
                var oViewModel2 = that2.getView().getModel("viewModel");
                if (!oComprobanteModel || !oViewModel2) { return; }

                // Importes según tipo de documento para que la validación del Paso 4 pase
                var sDocType = window.DemoTourCurrentDocType || "CONTRATO";
                var fBase, fIGV, fTotal;
                var bIndicadorIGV;
                if (sDocType === "OC") {
                    fBase = 18000; fIGV = 0; fTotal = 18000; bIndicadorIGV = false;
                } else if (sDocType === "P\u00f3liza" || sDocType === "POLIZA") {
                    fBase = 9333.33; fIGV = 0; fTotal = 9333.33; bIndicadorIGV = false;
                } else { // CONTRATO — un periodo ENE-2026: valorVenta=5000, igv=900, total=5900
                    fBase = 5000; fIGV = 900; fTotal = 5900; bIndicadorIGV = true;
                }

                oComprobanteModel.setProperty("/tipoDocumento", "01");
                oComprobanteModel.setProperty("/serieDocumento", "F001");
                oComprobanteModel.setProperty("/numeroDocumento", "00001234");
                oComprobanteModel.setProperty("/fechaEmision", "2025-03-26");
                oComprobanteModel.setProperty("/rucEmisor", "20601234560");
                oComprobanteModel.setProperty("/razonSocialEmisor", "INVERSIONES PRESENCIA SAC");
                oComprobanteModel.setProperty("/rucReceptor", "701951741");
                oComprobanteModel.setProperty("/razonSocialReceptor", "AMERICA MOVIL PERU SAC");
                oComprobanteModel.setProperty("/moneda", "PEN");
                oComprobanteModel.setProperty("/importeBase", fBase);
                oComprobanteModel.setProperty("/montoIGV", fIGV);
                oComprobanteModel.setProperty("/montoInafecto", 0);
                oComprobanteModel.setProperty("/montoTotal", fTotal);
                oComprobanteModel.setProperty("/indicadorIGV", bIndicadorIGV);
                oComprobanteModel.setProperty("/importeNeto", fTotal);
                oViewModel2.setProperty("/xmlLoaded", true);
                oViewModel2.setProperty("/xmlFileName", "F001-00001234.xml");
                oViewModel2.setProperty("/pdfLoaded", true);
                oViewModel2.setProperty("/pdfFileName", "F001-00001234.pdf");
                oViewModel2.setProperty("/rucEmisorValid", true);
                oViewModel2.setProperty("/rucReceptorValid", true);
                that2._validateStep1();
                that2._validateStep2();
                sap.m.MessageToast.show("Archivos XML y PDF cargados (Demo)");
                if (window.DemoTour) { window.DemoTour.onUserAction("xmlCargado"); }
            };

            // Paso 3 CONTRATO: los pendientes se cargan automáticamente al seleccionar el documento,
            // por lo que no se necesita selección de concepto manualmente
            window.DemoTourSelectFirstConcepto = function () {
                // No-op: los pendientes ya están cargados automáticamente (tabla RE-FX)
            };

            // Selecciona la primera fila de la tabla agrupada de Pendientes (CONTRATO RE-FX)
            window.DemoTourSelectAllPendientes = function () {
                var oTable = that2.byId("pendientesContratoTable");
                if (!oTable) { return; }
                var aItems = oTable.getItems ? oTable.getItems() : [];
                // Seleccionar el primer ColumnListItem (omitir GroupHeaderListItem)
                var oFirstRow = null;
                for (var i = 0; i < aItems.length; i++) {
                    if (aItems[i].isA && aItems[i].isA("sap.m.ColumnListItem")) {
                        oFirstRow = aItems[i];
                        break;
                    }
                }
                if (oFirstRow) {
                    oTable.setSelectedItem(oFirstRow, true);
                    that2.onPendientesContratoSelectionChange();
                }
            };

            // Selecciona la primera posición PENDIENTE (OC / Póliza)
            window.DemoTourSelectFirstPosicion = function () {
                var oTable = that2.byId("posicionesAsignacionTable");
                if (!oTable) { return; }
                var aItems = oTable.getItems ? oTable.getItems() : [];
                // Preferir la primera con estado PENDIENTE
                var oFirst = null;
                for (var i = 0; i < aItems.length; i++) {
                    var oCtx = aItems[i].getBindingContext("posiciones");
                    if (oCtx) {
                        var oObj = oCtx.getObject();
                        if (oObj && oObj.estado === "PENDIENTE" && !oObj.asignado) {
                            oFirst = aItems[i];
                            break;
                        }
                    }
                }
                if (!oFirst && aItems.length > 0) { oFirst = aItems[0]; }
                if (oFirst) {
                    oTable.setSelectedItem(oFirst, true);
                    that2.getView().getModel("viewModel").setProperty("/hasSelectedPosiciones", true);
                }
            };
        },
        
        _onRegisterForDocMatched: function (oEvent) {
            var oArgs = oEvent.getParameter("arguments");
            this._sDocumentId = oArgs.documentId;
            this._sTipoDocumento = oArgs.tipoDocumento;
            this._sNumeroDocumento = oArgs.numeroDocumento;
            this._sComprobanteId = null;
            this._sMode = "new";
            this._resetState();
            this._loadData();
        },

        _onVoucherDetailMatched: function (oEvent) {
            var oArgs = oEvent.getParameter("arguments");
            this._sDocumentId = oArgs.documentId;
            this._sTipoDocumento = oArgs.tipoDocumento;
            this._sNumeroDocumento = oArgs.numeroDocumento;
            this._sComprobanteId = oArgs.comprobanteId;
            this._sMode = oArgs.mode; // "view" or "edit"
            this._resetState();
            this._loadData();
        },
        
        _resetState: function () {
            var sMode = this._sMode || "new";
            var bReadOnly = sMode === "view";
            var sPageTitle;
            if (sMode === "view") {
                sPageTitle = "Visualizar Comprobante";
            } else if (sMode === "edit") {
                sPageTitle = "Editar Comprobante";
            } else {
                sPageTitle = "Registrar Comprobante";
            }
            
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setData({
                busy: false,
                mode: sMode,
                readOnly: bReadOnly,
                pageTitle: sPageTitle,
                step1Valid: false,
                step2Valid: false,
                step3Valid: false,
                step4Valid: false,
                canRegister: false,
                canSubmit: false,
                xmlLoaded: false,
                xmlFileName: "",
                pdfLoaded: false,
                pdfFileName: "",
                cdrLoaded: false,
                cdrFileName: "",
                otrosArchivos: [],
                rucEmisorValid: false,
                rucReceptorValid: false,
                selectedConceptoId: "",
                hasSelectedObligaciones: false,
                hasSelectedPosiciones: false,
                countSelectedPosiciones: 0,
                hasSelectedPendientes: false,
                periodoAsignacion: (function () {
                    var d = new Date();
                    return (d.getDate().toString().padStart(2, "0")) + "/" +
                           ((d.getMonth() + 1).toString().padStart(2, "0")) + "/" +
                           d.getFullYear();
                }()),
                posicionesPage: 1,
                posicionesTotalPages: 1,
                posicionesTotal: 0,
                registrationComplete: false,
                asignaciones: [],
                totalAsignado: 0,
                asignacionesCount: 0,
                validacionOk: false,
                validacionMessage: "",
                comparacion: [],
                currentStep: 1,
                isPhone: window.innerWidth < 600,
                searchTipoDocumento: "OC",
                searchNumeroDocumento: "",
                searchSociedad: "",
                searchFechaDesde: null,
                searchFechaHasta: null,
                searchMaterial: "",
                searchPerformed: false,
                searchResultsCount: 0,
                asignacionesResumen: "",
                documentosOrigenResumen: "",
                documentosOrigenEsLink: false,
                documentosOrigenLista: [],
                searchPage: 1,
                searchTotalPages: 1,
                documentSelected: false,
                selectedDocId: "",
                progMobilePage: 1,
                progMobileTotalPages: 1,
                progMobileTotal: 0,
                progMobilePrevEnabled: false,
                progMobileNextEnabled: false,
                progMobilePageInfo: "Pag 1 de 1 | 0 Reg.",
                pendMobilePage: 1,
                pendMobileTotalPages: 1,
                pendMobileTotal: 0,
                pendMobilePrevEnabled: false,
                pendMobileNextEnabled: false,
                pendMobilePageInfo: "Pag 1 de 1 | 0 Reg.",
                posMobilePage: 1,
                posMobileTotalPages: 1,
                posMobileTotal: 0,
                posMobilePrevEnabled: false,
                posMobileNextEnabled: false,
                posMobilePageInfo: "Pag 1 de 1 | 0 Reg.",
                progDesktopPage: 1,
                progDesktopTotalPages: 1,
                progDesktopTotal: 0,
                pendDesktopPage: 1,
                pendDesktopTotalPages: 1,
                pendDesktopTotal: 0,
                pendientesSelCount: 0,
                pendientesSelTotal: "0.00"
            });

            // Reset datos auxiliares
            this._allPosicionesData = [];
            this._allProgramacionData = [];
            this._allPendientesData = [];

            // Reset search results
            var oSearchModel = this.getView().getModel("searchResults");
            if (oSearchModel) { oSearchModel.setData([]); }
            var oSearchPagedModel = this.getView().getModel("searchResultsPaged");
            if (oSearchPagedModel) { oSearchPagedModel.setData([]); }
            this._allSearchResults = [];

            // Volver el Wizard al paso 1 solo en modo nuevo (view/edit navegan programáticamente)
            var that = this;
            setTimeout(function () {
                if (that._sMode === "new") {
                    var oWizard = that.byId("registerWizard");
                    var oStep1  = that.byId("wizardStep1");
                    if (oWizard && oStep1) {
                        try { oWizard.discardProgress(oStep1); } catch (e) { /* noop */ }
                    }
                }

                // Limpiar los controles FileUploader (resetean su valor interno)
                ["uploaderXML", "uploaderPDF", "uploaderCDR", "uploaderOtros"].forEach(function (sId) {
                    var oUploader = that.byId(sId);
                    if (oUploader) {
                        oUploader.clear();
                    }
                });
            }, 0);
        },
        
        _loadData: function () {
            var that = this;
            var oViewModel = this.getView().getModel("viewModel");
            
            oViewModel.setProperty("/busy", true);
            
            this._oMockDataService.loadAllData().then(function () {
                // Configurar el servicio de validación XML
                var oConfig = that._oMockDataService.getConfiguracion();
                that._oXMLValidatorService.setConfiguracion(oConfig);
                
                // Only load document detail if we have document context (VoucherDetail mode)
                if (that._sDocumentId) {
                    that._loadDocumentDetail();
                    that.getView().getModel("viewModel").setProperty("/documentSelected", true);
                    that.getView().getModel("viewModel").setProperty("/selectedDocId", that._sDocumentId);
                }
                
                // Si hay un comprobante a cargar (modo view o edit)
                if (that._sComprobanteId && that._sMode !== "new") {
                    that._loadComprobanteData(that._sComprobanteId);
                }
                
                oViewModel.setProperty("/busy", false);
            }).catch(function (oError) {
                oViewModel.setProperty("/busy", false);
                MessageBox.error("Error al cargar los datos: " + oError.message);
            });
        },
        
        _loadDocumentDetail: function () {
            var oDocumento = this._oMockDataService.getDocumentoById(this._sDocumentId);
            
            if (!oDocumento) {
                MessageBox.error("Documento no encontrado");
                this.onNavBack();
                return;
            }
            
            this.getView().getModel("detalle").setData(oDocumento);
            
            // Cargar datos específicos según tipo
            if (oDocumento.tipoDocumento === "CONTRATO") {
                this._loadContratoData(oDocumento.numeroDocumento);
            } else if (oDocumento.tipoDocumento === "OC") {
                this._loadOrdenCompraData(oDocumento.numeroDocumento);
            } else if (oDocumento.tipoDocumento === "POLIZA" || oDocumento.tipoDocumento === "Póliza") {
                this._loadPolizaData(oDocumento.numeroDocumento);
            }
        },
        
        _loadContratoData: function (sNumeroContrato) {
            var oContrato = this._oMockDataService.getContratoByNumero(sNumeroContrato);
            if (oContrato) {
                this.getView().getModel("contrato").setData(oContrato);
                this._loadAllPendientesContrato(oContrato);
            }
        },

        _loadAllPendientesContrato: function (oContrato) {
            var that = this;
            // Pre-compute totals per concept for the group header label
            var oConceptMap = {};
            (oContrato.conceptos || []).forEach(function (oCon) {
                var aPend = that._oMockDataService.getPendientesFact(oContrato.id, oCon.id);
                var fTotal = aPend.filter(function (p) { return !p.asignado; })
                    .reduce(function (acc, p) { return acc + (parseFloat(p.total) || 0); }, 0);
                oConceptMap[oCon.id] = {
                    codigo: oCon.codigo,
                    nombre: oCon.concepto,
                    total: fTotal,
                    // Label used as sorter group key so the GroupHeaderListItem shows meaningful text
                    label: oCon.codigo + "  \u2014  " + oCon.concepto + "   \u00b7   S/ " + fTotal.toFixed(2)
                };
            });
            // Build flat row array (no group-header placeholders; SAPUI5 Sorter handles grouping)
            var aPendAll = [];
            (oContrato.conceptos || []).forEach(function (oCon) {
                var aPend = that._oMockDataService.getPendientesFact(oContrato.id, oCon.id);
                aPend.forEach(function (p) {
                    var oCopy = Object.assign({}, p);
                    oCopy._conceptoCodigo = oCon.codigo;
                    oCopy._conceptoNombre = oCon.concepto;
                    oCopy._conceptoLabel  = oConceptMap[oCon.id].label;
                    oCopy._sourceDoc      = oContrato.numeroContrato;
                    oCopy._sourceDocType  = "Contrato";
                    aPendAll.push(oCopy);
                });
            });
            this._allPendientesData = aPendAll;
            this.getView().getModel("pendientesFact").setData(aPendAll);
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/pendientesSelCount", 0);
            oViewModel.setProperty("/pendientesSelTotal", "0.00");
        },
        
        _loadOrdenCompraData: function (sNumeroOC) {
            var oOrdenCompra = this._oMockDataService.getOrdenCompraByNumero(sNumeroOC);
            if (oOrdenCompra) {
                // Filtrar pendientes y hacer copia profunda para no mutar el mock
                var aAsignaciones = this.getView().getModel("viewModel").getProperty("/asignaciones") || [];
                var aPosiciones = oOrdenCompra.posiciones
                    .filter(function (oPos) { return oPos.estado === "PENDIENTE"; })
                    .map(function (oPos) {
                        var oCopy = Object.assign({}, oPos);
                        oCopy.asignado = aAsignaciones.some(function (a) { return a.id === oPos.id; });
                        return oCopy;
                    });
                this._allPosicionesData = aPosiciones;
                this._applyPosicionesPagination(1);
            }
        },
        
        _loadPolizaData: function (sNumeroPoliza) {
            var oPoliza = this._oMockDataService.getPolizaByNumero(sNumeroPoliza);
            if (oPoliza) {
                // Filtrar pendientes y hacer copia profunda para no mutar el mock
                var aAsignaciones = this.getView().getModel("viewModel").getProperty("/asignaciones") || [];
                var aPosiciones = oPoliza.posiciones
                    .filter(function (oPos) { return oPos.estado === "PENDIENTE"; })
                    .map(function (oPos) {
                        var oCopy = Object.assign({}, oPos);
                        oCopy.asignado = aAsignaciones.some(function (a) { return a.id === oPos.id; });
                        return oCopy;
                    });
                this._allPosicionesData = aPosiciones;
                this._applyPosicionesPagination(1);
            }
        },

        // ─── Búsqueda y Selección de Documento (Paso 3) ───────────────────────
        onSearchDocumento: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var sTipo = oViewModel.getProperty("/searchTipoDocumento");
            var sNumero = oViewModel.getProperty("/searchNumeroDocumento");
            var sSociedad = oViewModel.getProperty("/searchSociedad");
            var dFechaDesde = oViewModel.getProperty("/searchFechaDesde");
            var dFechaHasta = oViewModel.getProperty("/searchFechaHasta");
            var sMaterial = oViewModel.getProperty("/searchMaterial");

            var aResults = this._oMockDataService.getDocumentos({
                tipoDocumento: sTipo || null,
                numeroDocumento: sNumero || null,
                sociedad: sSociedad || null,
                fechaDesde: dFechaDesde || null,
                fechaHasta: dFechaHasta || null,
                material: sMaterial || null
            });

            this._allSearchResults = aResults;
            this.getView().getModel("searchResults").setData(aResults);
            oViewModel.setProperty("/searchPerformed", true);
            oViewModel.setProperty("/searchResultsCount", aResults.length);

            // NO borrar asignaciones previas al buscar — patrón MIRO
            // Solo limpiar la selección visual y los datos del documento actual
            oViewModel.setProperty("/documentSelected", false);
            oViewModel.setProperty("/selectedDocId", "");
            this._allPosicionesData = [];
            this._allProgramacionData = [];
            this._allPendientesData = [];
            this.getView().getModel("posiciones").setData([]);
            this.getView().getModel("programacion").setData([]);
            this.getView().getModel("pendientesFact").setData([]);

            // Apply pagination
            this._applySearchResultsPagination(1);
        },

        onClearSearchFilters: function () {
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/searchTipoDocumento", "OC");
            oViewModel.setProperty("/searchNumeroDocumento", "");
            oViewModel.setProperty("/searchSociedad", "");
            oViewModel.setProperty("/searchFechaDesde", null);
            oViewModel.setProperty("/searchFechaHasta", null);
            oViewModel.setProperty("/searchMaterial", "");
            // Reset DateRangeSelection
            var oDateRange = this.byId("dateRangeSearchFecha");
            if (oDateRange) {
                oDateRange.setDateValue(null);
                oDateRange.setSecondDateValue(null);
            }
        },

        onSearchTipoDocumentoChange: function () {
            // Limpiar filtros específicos al cambiar tipo de documento
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/searchNumeroDocumento", "");
            oViewModel.setProperty("/searchSociedad", "");
            oViewModel.setProperty("/searchFechaDesde", null);
            oViewModel.setProperty("/searchFechaHasta", null);
            oViewModel.setProperty("/searchMaterial", "");
            var oDateRange = this.byId("dateRangeSearchFecha");
            if (oDateRange) {
                oDateRange.setDateValue(null);
                oDateRange.setSecondDateValue(null);
            }
        },

        // ─── Paginación resultados de búsqueda ───────────────────────────
        _applySearchResultsPagination: function (iPage) {
            var iPageSize = this._iSearchPageSize || 10;
            var aAll = this._allSearchResults || [];
            var iTotal = aAll.length;
            var iTotalPages = Math.max(1, Math.ceil(iTotal / iPageSize));
            iPage = Math.min(Math.max(1, iPage), iTotalPages);
            var iStart = (iPage - 1) * iPageSize;
            var aPageData = aAll.slice(iStart, iStart + iPageSize);

            this.getView().getModel("searchResultsPaged").setData(aPageData);
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/searchPage", iPage);
            oViewModel.setProperty("/searchTotalPages", iTotalPages);

            // Limpiar selecciones al cambiar de página
            var oTable = this.byId("searchResultsTable");
            if (oTable) { oTable.removeSelections(true); }
            var oList = this.byId("searchResultsMobileList");
            if (oList) { oList.removeSelections(true); }
        },

        onSearchFirstPage: function () { this._applySearchResultsPagination(1); },
        onSearchPrevPage: function () {
            var iCurrent = this.getView().getModel("viewModel").getProperty("/searchPage");
            this._applySearchResultsPagination(iCurrent - 1);
        },
        onSearchNextPage: function () {
            var iCurrent = this.getView().getModel("viewModel").getProperty("/searchPage");
            this._applySearchResultsPagination(iCurrent + 1);
        },
        onSearchLastPage: function () {
            var iTotalPages = this.getView().getModel("viewModel").getProperty("/searchTotalPages");
            this._applySearchResultsPagination(iTotalPages);
        },

        // ─── Selección de documento en resultados (SingleSelect) ──────────
        onSearchResultSelect: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            if (!oItem) { return; }
            var oDoc = oItem.getBindingContext("searchResultsPaged").getObject();
            this._selectDocument(oDoc);
        },

        onSearchResultRowPress: function (oEvent) {
            var oItem = oEvent.getSource();
            var oDoc = oItem.getBindingContext("searchResultsPaged").getObject();
            this._selectDocument(oDoc);
        },

        onSearchResultPress: function (oEvent) {
            var oDoc = oEvent.getSource().getBindingContext("searchResultsPaged").getObject();
            // Set flag to preserve wizard state when returning from detail
            this._bPreserveState = true;
            this.getOwnerComponent().getRouter().navTo("RouteDocumentDetail", {
                documentId: oDoc.id,
                tipoDocumento: oDoc.tipoDocumento,
                numeroDocumento: oDoc.numeroDocumento
            });
        },

        onSearchResultMobilePress: function (oEvent) {
            var oItem = oEvent.getSource();
            var oDoc = oItem.getBindingContext("searchResultsPaged").getObject();
            this._selectDocument(oDoc);
        },

        _selectDocument: function (oDoc) {
            var that = this;

            // ── Validación SAP estándar: un contrato por comprobante ─────────
            // Si el nuevo documento es un CONTRATO, y ya hay asignaciones de un
            // contrato DISTINTO, avisar al usuario antes de continuar.
            if (oDoc.tipoDocumento === "CONTRATO") {
                var oViewModel0 = this.getView().getModel("viewModel");
                var aAsig0 = oViewModel0.getProperty("/asignaciones") || [];
                var aContratoAsig = aAsig0.filter(function (o) { return !!o._sourceDoc; });
                // Detectar si ya existe un contrato diferente asignado
                var sContratoActual = aContratoAsig.length > 0 ? aContratoAsig[0]._sourceDoc : null;
                var sNuevoContrato = oDoc.numeroDocumento;
                if (sContratoActual && sContratoActual !== sNuevoContrato) {
                    MessageBox.warning(
                        "Este comprobante ya tiene obligaciones asignadas del contrato " + sContratoActual + ".\n\n" +
                        "Un comprobante solo puede referir un único contrato (estándar SAP).\n\n" +
                        "Si continúa con el contrato " + sNuevoContrato + ", las asignaciones actuales serán eliminadas.",
                        {
                            title: "Cambio de contrato",
                            actions: ["Continuar con " + sNuevoContrato, MessageBox.Action.CANCEL],
                            emphasizedAction: "Continuar con " + sNuevoContrato,
                            onClose: function (sAction) {
                                if (sAction === "Continuar con " + sNuevoContrato) {
                                    // Limpiar asignaciones del contrato anterior y cargar el nuevo
                                    oViewModel0.setProperty("/asignaciones", []);
                                    oViewModel0.setProperty("/asignacionesCount", 0);
                                    oViewModel0.setProperty("/totalAsignado", 0);
                                    oViewModel0.setProperty("/step3Valid", false);
                                    that._realizarValidacionImportes();
                                    that._doSelectDocument(oDoc);
                                }
                                // Si cancela: no hace nada, mantiene el contrato actual
                            }
                        }
                    );
                    return; // Esperar respuesta del usuario
                }
            }

            this._doSelectDocument(oDoc);
        },

        _doSelectDocument: function (oDoc) {
            var that = this;
            this._sDocumentId = oDoc.id;
            this._sTipoDocumento = oDoc.tipoDocumento;
            this._sNumeroDocumento = oDoc.numeroDocumento;

            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/documentSelected", true);
            oViewModel.setProperty("/selectedDocId", oDoc.id);

            // Set document detail model
            this.getView().getModel("detalle").setData(oDoc);

            // NO borrar asignaciones previas — patrón MIRO acumulativo
            // Solo resetear datos del documento actual (posiciones/programación/pendientes)
            this._allPosicionesData = [];
            this._allProgramacionData = [];
            this._allPendientesData = [];
            oViewModel.setProperty("/hasSelectedPosiciones", false);
            oViewModel.setProperty("/hasSelectedPendientes", false);

            // Load type-specific data
            if (oDoc.tipoDocumento === "CONTRATO") {
                this._loadContratoData(oDoc.numeroDocumento);
            } else if (oDoc.tipoDocumento === "OC") {
                this._loadOrdenCompraData(oDoc.numeroDocumento);
            } else if (oDoc.tipoDocumento === "POLIZA" || oDoc.tipoDocumento === "Póliza") {
                this._loadPolizaData(oDoc.numeroDocumento);
            }

            this._updateAsignacionesResumen();
            MessageToast.show("Documento seleccionado: " + oDoc.tipoDocumentoDesc + " - " + oDoc.numeroDocumento);

            // Auto-scroll a la sección de posiciones/contrato
            setTimeout(function () {
                var sPanelId = oDoc.tipoDocumento === "CONTRATO" ? "contratoPanel" : "posicionesPanel";
                var oPanel = that.byId(sPanelId);
                if (oPanel && oPanel.getDomRef()) {
                    oPanel.getDomRef().scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }, 300);
        },

        // ─── Actualizar resumen de asignaciones acumuladas ────────────────
        _updateAsignacionesResumen: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var aAsignaciones = oViewModel.getProperty("/asignaciones") || [];

            if (aAsignaciones.length === 0) {
                oViewModel.setProperty("/asignacionesResumen", "");
                return;
            }

            // Agrupar por documento de origen
            var oGroups = {};
            aAsignaciones.forEach(function (oAsig) {
                var sKey = oAsig._sourceDoc || "Sin documento";
                if (!oGroups[sKey]) {
                    oGroups[sKey] = { count: 0, total: 0, tipo: oAsig._sourceDocType || "" };
                }
                oGroups[sKey].count++;
                oGroups[sKey].total += (oAsig.montoTotal || oAsig.importe || oAsig.total || 0);
            });

            var aParts = Object.keys(oGroups).map(function (sKey) {
                var g = oGroups[sKey];
                var sTipo = g.tipo ? g.tipo + " " : "";
                return sTipo + sKey + ": " + g.count + " pos. (" + g.total.toFixed(2) + ")";
            });

            var fTotal = aAsignaciones.reduce(function (s, o) {
                return s + (o.montoTotal || o.importe || o.total || 0);
            }, 0);

            oViewModel.setProperty("/asignacionesResumen",
                "Asignaciones acumuladas: " + aAsignaciones.length + " posición(es) | Total: " +
                fTotal.toFixed(2) + " | Detalle: " + aParts.join(" | ")
            );

            // Resumen de documentos origen para Paso 4
            var aDocLabels = Object.keys(oGroups).map(function (sKey) {
                return (oGroups[sKey].tipo ? oGroups[sKey].tipo + " " : "") + sKey;
            });
            oViewModel.setProperty("/documentosOrigenResumen", aDocLabels.join(", "));
        },

        // ─── Paginación: Tabla Posiciones Disponibles (OC / Póliza) ───────────────
        _applyPosicionesPagination: function (iPage) {
            var iPageSize = 10;
            var aAll = this._allPosicionesData || [];
            var iTotal = aAll.length;
            var iTotalPages = Math.max(1, Math.ceil(iTotal / iPageSize));
            iPage = Math.min(Math.max(1, iPage), iTotalPages);
            var iStart = (iPage - 1) * iPageSize;
            var aPageData = aAll.slice(iStart, iStart + iPageSize);

            this.getView().getModel("posiciones").setData(aPageData);

            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/posicionesPage", iPage);
            oViewModel.setProperty("/posicionesTotalPages", iTotalPages);
            oViewModel.setProperty("/posicionesTotal", iTotal);

            // Limpiar selección al cambiar de página
            var oTable = this.byId("posicionesAsignacionTable");
            if (oTable) {
                oTable.removeSelections(true);
                oViewModel.setProperty("/hasSelectedPosiciones", false);
            }

            // Sincronizar clases CSS de highlight tras cambio de datos
            var that = this;
            setTimeout(function () { that._refreshPosicionesHighlight(); }, 100);

            // Actualizar también la lista mobile paginada
            this._applyPosMobilePage(1);
        },

        onPosicionesFirstPage: function () {
            this._applyPosicionesPagination(1);
        },

        onPosicionesPrevPage: function () {
            var iPage = this.getView().getModel("viewModel").getProperty("/posicionesPage");
            this._applyPosicionesPagination(iPage - 1);
        },

        onPosicionesNextPage: function () {
            var iPage = this.getView().getModel("viewModel").getProperty("/posicionesPage");
            this._applyPosicionesPagination(iPage + 1);
        },

        onPosicionesLastPage: function () {
            var iTotalPages = this.getView().getModel("viewModel").getProperty("/posicionesTotalPages");
            this._applyPosicionesPagination(iTotalPages);
        },

        // ── Paginación Mobile: Posiciones (OC / Póliza) ───────────────────────
        _applyPosMobilePage: function (iPage) {
            var aAll = this._allPosicionesData || [];
            var iPS = this._iPosMobilePageSize;
            var iTotal = aAll.length;
            var iTotalPages = Math.max(1, Math.ceil(iTotal / iPS));
            iPage = Math.min(Math.max(1, iPage), iTotalPages);
            var aPage = aAll.slice((iPage - 1) * iPS, iPage * iPS);

            this.getView().getModel("posicionesPaged").setData(aPage);

            var oVM = this.getView().getModel("viewModel");
            oVM.setProperty("/posMobilePage", iPage);
            oVM.setProperty("/posMobileTotalPages", iTotalPages);
            oVM.setProperty("/posMobileTotal", iTotal);
            oVM.setProperty("/posMobilePrevEnabled", iPage > 1);
            oVM.setProperty("/posMobileNextEnabled", iPage < iTotalPages);
            oVM.setProperty("/posMobilePageInfo", "Pag " + iPage + " de " + iTotalPages + " | " + iTotal + " Reg.");

            // Limpiar selección mobile
            var oList = this.byId("posicionesMobileList");
            if (oList) {
                oList.removeSelections(true);
                oVM.setProperty("/hasSelectedPosiciones", false);
            }
        },

        onPosMobileFirstPage: function () { this._applyPosMobilePage(1); },
        onPosMobilePrevPage: function () {
            var iPage = this.getView().getModel("viewModel").getProperty("/posMobilePage");
            this._applyPosMobilePage(iPage - 1);
        },
        onPosMobileNextPage: function () {
            var iPage = this.getView().getModel("viewModel").getProperty("/posMobilePage");
            this._applyPosMobilePage(iPage + 1);
        },
        onPosMobileLastPage: function () {
            var iTotalPages = this.getView().getModel("viewModel").getProperty("/posMobileTotalPages");
            this._applyPosMobilePage(iTotalPages);
        },

        // ── Mobile Posición Dialog (solo lectura) ─────────────────────────────
        onOpenPosicionMobileDialog: function (oEvent) {
            var that = this;
            var oCtx = oEvent.getSource().getBindingContext("posicionesPaged");
            if (!oCtx) { return; }
            var oData = JSON.parse(JSON.stringify(oCtx.getObject()));
            if (!this.getView().getModel("posicionMobileDetail")) {
                this.getView().setModel(new JSONModel(oData), "posicionMobileDetail");
            } else {
                this.getView().getModel("posicionMobileDetail").setData(oData);
            }
            if (!this._oPosicionMobileDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "claro.com.clarocomprobantes.view.fragment.PosicionMobileDialog",
                    controller: this
                }).then(function (oDialog) {
                    that._oPosicionMobileDialog = oDialog;
                    that.getView().addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this._oPosicionMobileDialog.open();
            }
        },

        onClosePosicionMobileDialog: function () {
            this._oPosicionMobileDialog.close();
        },

        // ── Mobile: Selección, Asignar y Desasignar Posiciones ────────────────
        onPosicionesMobileSelectionChange: function () {
            var oList = this.byId("posicionesMobileList");
            var aSelected = oList.getSelectedItems();
            var oVM = this.getView().getModel("viewModel");
            oVM.setProperty("/hasSelectedPosiciones", aSelected.length > 0);
            oVM.setProperty("/countSelectedPosiciones", aSelected.length);
        },

        onAsignarPosicionesMobile: function () {
            var that = this;
            var oList = this.byId("posicionesMobileList");
            var aSelected = oList.getSelectedItems();
            if (aSelected.length === 0) {
                MessageToast.show("Seleccione al menos una posición");
                return;
            }

            var oViewModel = this.getView().getModel("viewModel");
            var aAsignaciones = oViewModel.getProperty("/asignaciones") || [];
            var oDetalle = this.getView().getModel("detalle").getData();

            aSelected.forEach(function (oItem) {
                var oPos = oItem.getBindingContext("posicionesPaged").getObject();

                var bExists = aAsignaciones.some(function (a) { return a.id === oPos.id; });
                if (!bExists) {
                    // Marcar como asignado para pintar la fila de verde
                    oPos.asignado = true;
                    // Sincronizar con datos originales
                    var oOrig = that._allPosicionesData.find(function (p) { return p.id === oPos.id; });
                    if (oOrig) { oOrig.asignado = true; }

                    var oAsig = Object.assign({}, oPos);
                    oAsig.montoTotal = oPos.importe;
                    // Etiquetar con documento de origen (patrón MIRO)
                    oAsig._sourceDoc = oDetalle.numeroDocumento;
                    oAsig._sourceDocType = oDetalle.tipoDocumentoDesc;
                    oAsig._sourceDocId = oDetalle.id;
                    oAsig._sourceDocTipo = oDetalle.tipoDocumento;
                    aAsignaciones.push(oAsig);
                }
            });

            oViewModel.setProperty("/asignaciones", aAsignaciones);
            that.getView().getModel("posicionesPaged").refresh(true);

            oList.removeSelections(true);
            oViewModel.setProperty("/hasSelectedPosiciones", false);
            oViewModel.setProperty("/countSelectedPosiciones", 0);

            this._calcularTotalAsignado();
            this._validateStep3();

            setTimeout(function () {
                that._realizarValidacionImportes();
            }, 150);

            MessageToast.show(aSelected.length + " posición(es) asignada(s)");
        },

        onDesasignarPosicionesMobile: function () {
            var that = this;
            var oList = this.byId("posicionesMobileList");
            var aSelected = oList.getSelectedItems();
            if (aSelected.length === 0) {
                MessageToast.show("Seleccione posiciones a desasignar");
                return;
            }

            var oViewModel = this.getView().getModel("viewModel");
            var aAsignaciones = oViewModel.getProperty("/asignaciones") || [];

            aSelected.forEach(function (oItem) {
                var oPos = oItem.getBindingContext("posicionesPaged").getObject();

                // Quitar el color verde
                oPos.asignado = false;
                var oOrig = that._allPosicionesData.find(function (p) { return p.id === oPos.id; });
                if (oOrig) { oOrig.asignado = false; }

                var iIdx = aAsignaciones.findIndex(function (a) { return a.id === oPos.id; });
                if (iIdx >= 0) { aAsignaciones.splice(iIdx, 1); }
            });

            oViewModel.setProperty("/asignaciones", aAsignaciones);
            that.getView().getModel("posicionesPaged").refresh(true);

            oList.removeSelections(true);
            oViewModel.setProperty("/hasSelectedPosiciones", false);

            this._calcularTotalAsignado();
            this._validateStep3();

            setTimeout(function () {
                that._realizarValidacionImportes();
            }, 150);

            MessageToast.show(aSelected.length + " posición(es) desasignada(s)");
        },

        // ── Paginación Mobile: Programación ────────────────────────────────────
        _applyProgMobilePage: function (iPage) {
            var aAll = this.getView().getModel("programacion").getData() || [];
            var iPS = this._iMobilePageSize;
            var iTotal = aAll.length;
            var iTotalPages = Math.max(1, Math.ceil(iTotal / iPS));
            iPage = Math.min(Math.max(1, iPage), iTotalPages);
            var aPage = aAll.slice((iPage - 1) * iPS, (iPage - 1) * iPS + iPS).map(function (o, i) {
                return Object.assign({}, o, { _origIdx: (iPage - 1) * iPS + i });
            });
            this.getView().getModel("programacionPaged").setData(aPage);
            var oVM = this.getView().getModel("viewModel");
            oVM.setProperty("/progMobilePage", iPage);
            oVM.setProperty("/progMobileTotalPages", iTotalPages);
            oVM.setProperty("/progMobileTotal", iTotal);
            oVM.setProperty("/progMobilePrevEnabled", iPage > 1);
            oVM.setProperty("/progMobileNextEnabled", iPage < iTotalPages);
            oVM.setProperty("/progMobilePageInfo", "Pag " + iPage + " de " + iTotalPages + " | " + iTotal + " Reg.");
        },
        onProgMobileFirstPage: function () { this._applyProgMobilePage(1); },
        onProgMobilePrevPage: function () {
            this._applyProgMobilePage(this.getView().getModel("viewModel").getProperty("/progMobilePage") - 1);
        },
        onProgMobileNextPage: function () {
            this._applyProgMobilePage(this.getView().getModel("viewModel").getProperty("/progMobilePage") + 1);
        },
        onProgMobileLastPage: function () {
            this._applyProgMobilePage(this.getView().getModel("viewModel").getProperty("/progMobileTotalPages"));
        },

        // ── Paginación Mobile: Pendientes por Facturar ─────────────────────────
        _applyPendMobilePage: function (iPage) {
            var aAll = this._allPendientesData || [];
            var iPS = this._iMobilePageSize;
            var iTotal = aAll.length;
            var iTotalPages = Math.max(1, Math.ceil(iTotal / iPS));
            iPage = Math.min(Math.max(1, iPage), iTotalPages);
            var aPage = aAll.slice((iPage - 1) * iPS, (iPage - 1) * iPS + iPS).map(function (o, i) {
                return Object.assign({}, o, { _origIdx: (iPage - 1) * iPS + i });
            });
            this.getView().getModel("pendientesFactPaged").setData(aPage);
            var oVM = this.getView().getModel("viewModel");
            oVM.setProperty("/pendMobilePage", iPage);
            oVM.setProperty("/pendMobileTotalPages", iTotalPages);
            oVM.setProperty("/pendMobileTotal", iTotal);
            oVM.setProperty("/pendMobilePrevEnabled", iPage > 1);
            oVM.setProperty("/pendMobileNextEnabled", iPage < iTotalPages);
            oVM.setProperty("/pendMobilePageInfo", "Pag " + iPage + " de " + iTotalPages + " | " + iTotal + " Reg.");
            // Limpiar selección al cambiar de página
            var oList = this.byId("pendientesFactMobileList");
            if (oList) {
                oList.removeSelections(true);
                oVM.setProperty("/hasSelectedPendientes", false);
            }
        },
        onPendMobileFirstPage: function () { this._applyPendMobilePage(1); },
        onPendMobilePrevPage: function () {
            this._applyPendMobilePage(this.getView().getModel("viewModel").getProperty("/pendMobilePage") - 1);
        },
        onPendMobileNextPage: function () {
            this._applyPendMobilePage(this.getView().getModel("viewModel").getProperty("/pendMobilePage") + 1);
        },
        onPendMobileLastPage: function () {
            this._applyPendMobilePage(this.getView().getModel("viewModel").getProperty("/pendMobileTotalPages"));
        },

        // ── Paginación Desktop: Programación (Contratos) ──────────────────────
        _applyProgDesktopPage: function (iPage) {
            var iPageSize = 10;
            var aAll = this._allProgramacionData || [];
            var iTotal = aAll.length;
            var iTotalPages = Math.max(1, Math.ceil(iTotal / iPageSize));
            iPage = Math.min(Math.max(1, iPage), iTotalPages);
            var iStart = (iPage - 1) * iPageSize;
            var aPageData = aAll.slice(iStart, iStart + iPageSize);

            this.getView().getModel("programacion").setData(aPageData);

            var oVM = this.getView().getModel("viewModel");
            oVM.setProperty("/progDesktopPage", iPage);
            oVM.setProperty("/progDesktopTotalPages", iTotalPages);
            oVM.setProperty("/progDesktopTotal", iTotal);

            // Actualizar también la lista mobile paginada
            this._applyProgMobilePage(1);
        },
        onProgDesktopFirstPage: function () { this._applyProgDesktopPage(1); },
        onProgDesktopPrevPage: function () {
            this._applyProgDesktopPage(this.getView().getModel("viewModel").getProperty("/progDesktopPage") - 1);
        },
        onProgDesktopNextPage: function () {
            this._applyProgDesktopPage(this.getView().getModel("viewModel").getProperty("/progDesktopPage") + 1);
        },
        onProgDesktopLastPage: function () {
            this._applyProgDesktopPage(this.getView().getModel("viewModel").getProperty("/progDesktopTotalPages"));
        },

        // ── Paginación Desktop: Pendientes por Facturar (Contratos) ───────────
        _syncPendDesktopBack: function () {
            var oVM = this.getView().getModel("viewModel");
            var iCurrentPage = oVM.getProperty("/pendDesktopPage");
            var iPageSize = 10;
            var iStart = (iCurrentPage - 1) * iPageSize;
            var aCurrentPageData = this.getView().getModel("pendientesFact").getData() || [];
            for (var i = 0; i < aCurrentPageData.length; i++) {
                if (this._allPendientesData[iStart + i]) {
                    Object.assign(this._allPendientesData[iStart + i], aCurrentPageData[i]);
                }
            }
        },
        _applyPendDesktopPage: function (iPage) {
            // Sync current page edits back before changing page
            if (this._allPendientesData && this._allPendientesData.length > 0) {
                this._syncPendDesktopBack();
            }
            var iPageSize = 10;
            var aAll = this._allPendientesData || [];
            var iTotal = aAll.length;
            var iTotalPages = Math.max(1, Math.ceil(iTotal / iPageSize));
            iPage = Math.min(Math.max(1, iPage), iTotalPages);
            var iStart = (iPage - 1) * iPageSize;
            var aPageData = aAll.slice(iStart, iStart + iPageSize);

            this.getView().getModel("pendientesFact").setData(aPageData);

            var oVM = this.getView().getModel("viewModel");
            oVM.setProperty("/pendDesktopPage", iPage);
            oVM.setProperty("/pendDesktopTotalPages", iTotalPages);
            oVM.setProperty("/pendDesktopTotal", iTotal);

            // Ajustar visibleRowCount del grid table
            var oTable = this.byId("pendientesFactTable");
            if (oTable) {
                oTable.setVisibleRowCount(Math.max(1, aPageData.length));
            }

            // Limpiar selección al cambiar de página
            if (oTable) {
                oTable.clearSelection();
                oVM.setProperty("/hasSelectedPendientes", false);
            }

            // Actualizar también la lista mobile paginada
            this._applyPendMobilePage(1);
        },
        onPendDesktopFirstPage: function () { this._applyPendDesktopPage(1); },
        onPendDesktopPrevPage: function () {
            this._applyPendDesktopPage(this.getView().getModel("viewModel").getProperty("/pendDesktopPage") - 1);
        },
        onPendDesktopNextPage: function () {
            this._applyPendDesktopPage(this.getView().getModel("viewModel").getProperty("/pendDesktopPage") + 1);
        },
        onPendDesktopLastPage: function () {
            this._applyPendDesktopPage(this.getView().getModel("viewModel").getProperty("/pendDesktopTotalPages"));
        },

        _loadComprobanteData: function (sComprobanteId) {
            var oComprobante = this._oMockDataService.getComprobanteById(sComprobanteId);
            
            if (!oComprobante) {
                MessageToast.show("No se encontró el comprobante: " + sComprobanteId);
                return;
            }
            
            var oViewModel = this.getView().getModel("viewModel");
            var oComprobanteModel = this.getView().getModel("comprobante");
            
            // Poblar modelo del comprobante con datos existentes
            oComprobanteModel.setData({
                tipoFactura: oComprobante.tipoFactura || "ELECTRONICO",
                tipoDocumento: oComprobante.tipoDocumentoPago || "01",
                serieDocumento: oComprobante.serieDocumento,
                numeroDocumento: oComprobante.numeroDocumento,
                fechaEmision: oComprobante.fechaEmision,
                fechaRecepcion: oComprobante.fechaRecepcion || oComprobante.fechaCreacion,
                rucEmisor: oComprobante.rucEmisor,
                razonSocialEmisor: oComprobante.razonSocialEmisor,
                rucReceptor: oComprobante.rucReceptor,
                razonSocialReceptor: oComprobante.razonSocialReceptor,
                moneda: oComprobante.moneda,
                importeBase: oComprobante.importeBase || 0,
                montoIGV: oComprobante.montoIGV || 0,
                montoInafecto: oComprobante.montoInafecto || 0,
                montoTotal: oComprobante.montoTotal || 0,
                indicadorIGV: oComprobante.indicadorIGV !== undefined ? oComprobante.indicadorIGV : true,
                indicadorImpuesto: oComprobante.indicadorImpuesto || "1000",
                porcentajeDetraccion: oComprobante.porcentajeDetraccion || 0,
                montoDetraccion: oComprobante.montoDetraccion || 0,
                importeNeto: oComprobante.importeNeto || oComprobante.montoTotal || 0,
                periodoMes: oComprobante.periodoMes || (new Date().getMonth() + 1),
                periodoAnio: oComprobante.periodoAnio || new Date().getFullYear(),
                estado: oComprobante.estado
            });
            
            // Estado de archivos
            var sXml = (oComprobante.archivos && oComprobante.archivos.xml) || "";
            var sPdf = (oComprobante.archivos && oComprobante.archivos.pdf) || "";
            var sCdr = (oComprobante.archivos && oComprobante.archivos.cdr) || "";
            
            oViewModel.setProperty("/xmlLoaded", !!sXml);
            oViewModel.setProperty("/xmlFileName", sXml);
            oViewModel.setProperty("/pdfLoaded", !!sPdf);
            oViewModel.setProperty("/pdfFileName", sPdf);
            oViewModel.setProperty("/cdrLoaded", !!sCdr);
            oViewModel.setProperty("/cdrFileName", sCdr);
            oViewModel.setProperty("/rucEmisorValid", true);
            oViewModel.setProperty("/rucReceptorValid", true);
            
            // Asignaciones desde posiciones asignadas
            // Incluye desglose completo (valorVenta/igv/inafecto/total) para que
            // _realizarValidacionImportes pueda comparar las 4 filas correctamente.
            var aAsignaciones = [];
            if (oComprobante.posicionesAsignadas && oComprobante.posicionesAsignadas.length > 0) {
                var fTotalCompPos = oComprobante.montoTotal || 1;
                aAsignaciones = oComprobante.posicionesAsignadas.map(function (oPos) {
                    var fImporte = oPos.importe || 0;
                    var fRatio   = fTotalCompPos > 0 ? fImporte / fTotalCompPos : 0;
                    return {
                        descripcion:  oPos.descripcion || ("Posición " + oPos.posicion),
                        valorVenta:   +((oComprobante.importeBase   || 0) * fRatio).toFixed(2),
                        igv:          +((oComprobante.montoIGV      || 0) * fRatio).toFixed(2),
                        inafecto:     +((oComprobante.montoInafecto || 0) * fRatio).toFixed(2),
                        total:        fImporte,
                        montoTotal:   fImporte,
                        moneda:       oComprobante.moneda,
                        mesPago:      "-",
                        glosa:        oPos.descripcion || "-"
                    };
                });
            } else if (oComprobante.obligacionesAsignadas && oComprobante.obligacionesAsignadas.length > 0) {
                aAsignaciones = oComprobante.obligacionesAsignadas.map(function (oObl) {
                    return {
                        conceptoPago: oObl.conceptoPago || oObl.glosa || "Obligación",
                        descripcion:  oObl.glosa || "Obligación",
                        valorVenta:   oObl.valorVenta   || 0,
                        igv:          oObl.igv           || 0,
                        inafecto:     oObl.inafecto      || 0,
                        total:        oObl.total         || oObl.montoTotal || 0,
                        montoTotal:   oObl.montoTotal    || oObl.total      || 0,
                        moneda:       oComprobante.moneda,
                        mesPago:      oObl.mesPago || "-",
                        glosa:        oObl.glosa   || "-"
                    };
                });
            }
            oViewModel.setProperty("/asignaciones", aAsignaciones);

            var fTotalAsig = aAsignaciones.reduce(function (fSum, oA) {
                return fSum + (parseFloat(oA.total) || parseFloat(oA.montoTotal) || 0);
            }, 0);
            oViewModel.setProperty("/totalAsignado", fTotalAsig);

            // Marcar todos los pasos como válidos para permitir navegación
            var bEditable = !oViewModel.getProperty("/readOnly");
            oViewModel.setProperty("/step1Valid", true);
            oViewModel.setProperty("/step2Valid", true);
            oViewModel.setProperty("/step3Valid", true);
            oViewModel.setProperty("/step4Valid", true);

            // Cargar datos de Paso 3 (posiciones u obligaciones ya asignadas)
            this._loadStep3FromComprobante(oComprobante);

            // En modo view y edit avanzar el Wizard hasta el último paso
            // y recalcular la comparación de importes con la función canónica
            if (this._sMode === "view" || this._sMode === "edit") {
                var bEdit = (this._sMode === "edit");
                var that2 = this;
                setTimeout(function () {
                    // Recalcular comparación usando la lógica canónica (4 filas)
                    that2._realizarValidacionImportes();
                    // En edición canRegister/canSubmit dependen del resultado
                    if (!bEdit) {
                        // read-only: inhabilitar siempre
                        that2.getView().getModel("viewModel").setProperty("/canRegister", false);
                        that2.getView().getModel("viewModel").setProperty("/canSubmit", false);
                    }

                    var oWizard   = that2.byId("registerWizard");
                    var oLastStep = that2.byId("wizardStep4");
                    if (oWizard && oLastStep) {
                        try { oWizard.setCurrentStep(oLastStep); } catch (e) { /* noop */ }
                    }
                    that2._refreshPosicionesHighlight();
                }, 300);
            }
        },

        /**
         * Carga los datos de asignación (Paso 3) cuando se visualiza o edita un comprobante existente.
         * Para OC/Póliza: carga todas las posiciones marcando las asignadas.
         * Para Contrato: carga las obligaciones asignadas y la programación del primer concepto.
         */
        _loadStep3FromComprobante: function (oComprobante) {
            var that = this;
            var oDetalle = this.getView().getModel("detalle").getData();
            if (!oDetalle) { return; }
            var sTipoDoc = oDetalle.tipoDocumento;
            var sNumero  = oDetalle.numeroDocumento;

            if (sTipoDoc === "OC") {
                var oOC = this._oMockDataService.getOrdenCompraByNumero(sNumero);
                if (oOC && oOC.posiciones) {
                    var aPosAsig = oComprobante.posicionesAsignadas || [];
                    var aPosOC   = oOC.posiciones.map(function (oPos) {
                        var bAsig = aPosAsig.some(function (a) {
                            return a.posicion === oPos.posicion || a.id === oPos.id;
                        });
                        return Object.assign({}, oPos, { asignado: bAsig });
                    });
                    this._allPosicionesData = aPosOC;
                    this._applyPosicionesPagination(1);
                    setTimeout(function () { that._refreshPosicionesHighlight(); }, 300);
                }

            } else if (sTipoDoc === "Póliza" || sTipoDoc === "POLIZA") {
                var oPoliza = this._oMockDataService.getPolizaByNumero(sNumero);
                if (oPoliza && oPoliza.posiciones) {
                    var aPosAsigP = oComprobante.posicionesAsignadas || [];
                    var aPosP    = oPoliza.posiciones.map(function (oPos) {
                        var bAsigP = aPosAsigP.some(function (a) {
                            return a.posicion === oPos.posicion || a.id === oPos.id;
                        });
                        return Object.assign({}, oPos, { asignado: bAsigP });
                    });
                    this._allPosicionesData = aPosP;
                    this._applyPosicionesPagination(1);
                    setTimeout(function () { that._refreshPosicionesHighlight(); }, 300);
                }

            } else if (sTipoDoc === "CONTRATO") {
                // En modo vista/edición: cargar toda la tabla RE-FX con el estado actual del contrato
                var oContratoRO = this.getView().getModel("contrato").getData();
                if (oContratoRO && oContratoRO.id) {
                    this._loadAllPendientesContrato(oContratoRO);
                }
            }
        },
        
        onTipoFacturaChange: function () {
            // Manejar cambio de tipo de factura
        },
        
        onXMLFileChange: function (oEvent) {
            var that = this;
            var oFileUploader = oEvent.getSource();
            var aFiles = oEvent.getParameter("files");
            
            if (!aFiles || aFiles.length === 0) {
                return;
            }
            
            var oFile = aFiles[0];
            var oViewModel = this.getView().getModel("viewModel");
            
            oViewModel.setProperty("/busy", true);
            
            // Parsear y validar el XML
            this._oXMLValidatorService.parseXMLFactura(oFile).then(function (oResult) {
                if (oResult.success) {
                    var oFacturaData = oResult.data;
                    
                    // Actualizar modelo del comprobante con datos del XML
                    var oComprobanteModel = that.getView().getModel("comprobante");
                    oComprobanteModel.setProperty("/tipoDocumento", oFacturaData.tipoDocumento);
                    oComprobanteModel.setProperty("/serieDocumento", oFacturaData.serieDocumento);
                    oComprobanteModel.setProperty("/numeroDocumento", oFacturaData.numeroDocumento);
                    oComprobanteModel.setProperty("/fechaEmision", oFacturaData.fechaEmision);
                    oComprobanteModel.setProperty("/rucEmisor", oFacturaData.rucEmisor);
                    oComprobanteModel.setProperty("/razonSocialEmisor", oFacturaData.razonSocialEmisor);
                    oComprobanteModel.setProperty("/rucReceptor", oFacturaData.rucReceptor);
                    oComprobanteModel.setProperty("/razonSocialReceptor", oFacturaData.razonSocialReceptor);
                    oComprobanteModel.setProperty("/moneda", oFacturaData.moneda);
                    oComprobanteModel.setProperty("/importeBase", oFacturaData.importeBase);
                    oComprobanteModel.setProperty("/montoIGV", oFacturaData.montoIGV);
                    oComprobanteModel.setProperty("/montoInafecto", oFacturaData.montoInafecto);
                    oComprobanteModel.setProperty("/montoTotal", oFacturaData.montoTotal);
                    oComprobanteModel.setProperty("/indicadorIGV", oFacturaData.indicadorIGV);
                    oComprobanteModel.setProperty("/indicadorImpuesto", oFacturaData.indicadorImpuesto);
                    oComprobanteModel.setProperty("/porcentajeDetraccion", oFacturaData.porcentajeDetraccion);
                    oComprobanteModel.setProperty("/montoDetraccion", oFacturaData.montoDetraccion);
                    oComprobanteModel.setProperty("/importeNeto", oFacturaData.importeNeto);
                    
                    // Validar RUCs
                    var oUsuario = that._oMockDataService.getUsuarioActual();
                    var oValidacionEmisor = that._oXMLValidatorService.validarRucEmisor(oFacturaData.rucEmisor, oUsuario.ruc);
                    var oValidacionReceptor = that._oXMLValidatorService.validarRucReceptor(oFacturaData.rucReceptor);
                    
                    oViewModel.setProperty("/rucEmisorValid", oValidacionEmisor.valid);
                    oViewModel.setProperty("/rucReceptorValid", oValidacionReceptor.valid);
                    
                    // Mostrar advertencias si los RUC no coinciden
                    if (!oValidacionEmisor.valid) {
                        MessageBox.warning(oValidacionEmisor.message);
                    }
                    if (!oValidacionReceptor.valid) {
                        MessageBox.warning(oValidacionReceptor.message);
                    }
                    
                    // Actualizar estado
                    oViewModel.setProperty("/xmlLoaded", true);
                    oViewModel.setProperty("/xmlFileName", oFile.name);
                    
                    that._validateStep1();
                    that._validateStep2();
                    
                    MessageToast.show("Archivo XML procesado correctamente");
                }
                
                oViewModel.setProperty("/busy", false);
            }).catch(function (oError) {
                oViewModel.setProperty("/busy", false);
                oViewModel.setProperty("/xmlLoaded", false);
                
                MessageBox.error(oError.message, {
                    details: oError.details
                });
            });
        },
        
        onPDFFileChange: function (oEvent) {
            var aFiles = oEvent.getParameter("files");
            
            if (!aFiles || aFiles.length === 0) {
                return;
            }
            
            var oFile = aFiles[0];
            var oViewModel = this.getView().getModel("viewModel");
            
            // Validar tamaño (máximo 10MB)
            if (oFile.size > 10 * 1024 * 1024) {
                MessageBox.error("El archivo PDF excede el tamaño máximo permitido (10MB)");
                return;
            }
            
            oViewModel.setProperty("/pdfLoaded", true);
            oViewModel.setProperty("/pdfFileName", oFile.name);
            
            this._validateStep1();
            
            MessageToast.show("Archivo PDF cargado");
        },
        
        onCDRFileChange: function (oEvent) {
            var aFiles = oEvent.getParameter("files");
            
            if (!aFiles || aFiles.length === 0) {
                return;
            }
            
            var oFile = aFiles[0];
            var oViewModel = this.getView().getModel("viewModel");
            
            oViewModel.setProperty("/cdrLoaded", true);
            oViewModel.setProperty("/cdrFileName", oFile.name);
            
            MessageToast.show("CDR cargado");
        },
        
        onOtrosFilesChange: function (oEvent) {
            var aFiles = oEvent.getParameter("files");
            var oViewModel = this.getView().getModel("viewModel");
            
            var aOtrosArchivos = oViewModel.getProperty("/otrosArchivos") || [];
            
            for (var i = 0; i < aFiles.length; i++) {
                aOtrosArchivos.push({
                    name: aFiles[i].name,
                    size: aFiles[i].size,
                    file: aFiles[i]
                });
            }
            
            oViewModel.setProperty("/otrosArchivos", aOtrosArchivos);
        },
        
        onOtroArchivoPress: function (oEvent) {
            // Acción al presionar un archivo adicional
        },
        
        _validateStep1: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var bXmlLoaded = oViewModel.getProperty("/xmlLoaded");
            var bPdfLoaded = oViewModel.getProperty("/pdfLoaded");
            
            var bValid = bXmlLoaded && bPdfLoaded;
            oViewModel.setProperty("/step1Valid", bValid);
            
            return bValid;
        },
        
        _validateStep2: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var bRucEmisorValid = oViewModel.getProperty("/rucEmisorValid");
            var bRucReceptorValid = oViewModel.getProperty("/rucReceptorValid");
            var oComprobante = this.getView().getModel("comprobante").getData();
            
            var bValid = bRucEmisorValid && bRucReceptorValid && 
                         oComprobante.serieDocumento && oComprobante.numeroDocumento &&
                         oComprobante.montoTotal > 0;
            
            oViewModel.setProperty("/step2Valid", bValid);
            
            return bValid;
        },
        
        onPendientesContratoSelectionChange: function () {
            var oTable = this.byId("pendientesContratoTable");
            if (!oTable) { return; }
            var aItems = oTable.getSelectedItems() || [];
            var fTotal = 0;
            aItems.forEach(function (oItem) {
                var oCtx = oItem.getBindingContext("pendientesFact");
                if (oCtx) {
                    fTotal += parseFloat(oCtx.getProperty("total")) || 0;
                }
            });
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/pendientesSelCount", aItems.length);
            oViewModel.setProperty("/pendientesSelTotal", fTotal.toFixed(2));
        },

        onPendienteContratoImporteChange: function (oEvent) {
            var oInput = oEvent.getSource();
            var sLiveValue = oEvent.getParameter("value") || "";
            var oCtx = oInput.getBindingContext("pendientesFact");
            if (!oCtx) { return; }
            var oModel = this.getView().getModel("pendientesFact");
            var sBindingPath = oInput.getBinding("value") ? oInput.getBinding("value").getPath() : "";
            var fValorVenta, fIGV;
            if (sBindingPath === "valorVenta") {
                fValorVenta = parseFloat(sLiveValue) || 0;
                fIGV        = parseFloat(oModel.getProperty(oCtx.getPath() + "/igv")) || 0;
            } else {
                fValorVenta = parseFloat(oModel.getProperty(oCtx.getPath() + "/valorVenta")) || 0;
                fIGV        = parseFloat(sLiveValue) || 0;
            }
            oModel.setProperty(oCtx.getPath() + "/total", parseFloat((fValorVenta + fIGV).toFixed(2)));
        },

        onAsignarPendientesContrato: function () {
            var that = this;
            var oTable = this.byId("pendientesContratoTable");
            var aItems = oTable ? oTable.getSelectedItems() : [];
            if (aItems.length === 0) {
                MessageToast.show("Seleccione al menos un período pendiente");
                return;
            }
            var oModel = this.getView().getModel("pendientesFact");
            aItems.forEach(function (oItem) {
                var oCtx = oItem.getBindingContext("pendientesFact");
                if (oCtx) {
                    oModel.setProperty(oCtx.getPath() + "/asignado", true);
                    // Sync back to master array
                    var sPath = oCtx.getPath(); // e.g. "/5"
                    var iIdx = parseInt(sPath.replace("/", ""), 10);
                    if (!isNaN(iIdx) && that._allPendientesData[iIdx]) {
                        that._allPendientesData[iIdx].asignado = true;
                    }
                }
            });
            oTable.removeSelections(true);
            var aAsig = this._allPendientesData.filter(function (o) { return !!o.asignado; });
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/pendientesSelCount", 0);
            oViewModel.setProperty("/pendientesSelTotal", "0.00");
            oViewModel.setProperty("/asignaciones", aAsig);
            oViewModel.setProperty("/step3Valid", true);
            setTimeout(function () {
                that._realizarValidacionImportes();
                that._navigateToStep4();
            }, 150);
            MessageToast.show(aAsig.length + " registro(s) asignado(s)");
            if (window.DemoTour) { window.DemoTour.onUserAction("obligacionesAsignadas"); }
        },

        onLimpiarSeleccionContrato: function () {
            var oTable = this.byId("pendientesContratoTable");
            if (oTable) { oTable.removeSelections(true); }
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/pendientesSelCount", 0);
            oViewModel.setProperty("/pendientesSelTotal", "0.00");
        },

        onDesasignarPendientesContrato: function () {
            var that = this;
            var oTable = this.byId("pendientesContratoTable");
            var aItems = oTable ? oTable.getSelectedItems() : [];
            if (aItems.length === 0) {
                MessageToast.show("Seleccione los períodos a desasignar");
                return;
            }
            var oModel = this.getView().getModel("pendientesFact");
            aItems.forEach(function (oItem) {
                var oCtx = oItem.getBindingContext("pendientesFact");
                if (oCtx) {
                    oModel.setProperty(oCtx.getPath() + "/asignado", false);
                    var iIdx = parseInt(oCtx.getPath().replace("/", ""), 10);
                    if (!isNaN(iIdx) && that._allPendientesData[iIdx]) {
                        that._allPendientesData[iIdx].asignado = false;
                    }
                }
            });
            oTable.removeSelections(true);
            var aAsig = this._allPendientesData.filter(function (o) { return !!o.asignado; });
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/pendientesSelCount", 0);
            oViewModel.setProperty("/pendientesSelTotal", "0.00");
            oViewModel.setProperty("/asignaciones", aAsig);
            oViewModel.setProperty("/step3Valid", aAsig.length > 0);
            this._updateAsignacionesResumen();
            this._realizarValidacionImportes();
            MessageToast.show(aItems.length + " período(s) desasignado(s)");
        },

        onConceptoChange: function (oEvent) {
            // Legacy — mantenido para compatibilidad pero ya no tiene efecto
        },

        onAgregarConcepto: function () {
            // Legacy — mantenido para compatibilidad pero ya no tiene efecto
        },

        onObligacionesSelectionChange: function (oEvent) {
            var oTable = this.byId("obligacionesTable");
            var aSelectedItems = oTable ? oTable.getSelectedItems() : [];
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/hasSelectedObligaciones", aSelectedItems.length > 0);
        },

        onPendientesFactSelectionChange: function () {
            // Legacy — tabla t:Table reemplazada por sap.m.Table
        },

        onPendienteImporteChange: function (oEvent) {
            this.onPendienteContratoImporteChange(oEvent);
        },

        // ── Mobile Pendientes (Option B: List + Edit Dialog) ─────────────────────

        onPendientesFactMobileSelectionChange: function () {
            // Legacy — sección mobile eliminada
        },

        onOpenPendienteMobileDialog: function () { /* Legacy */ },
        onConfirmPendienteMobileDialog: function () { /* Legacy */ },
        onCancelPendienteMobileDialog: function () { /* Legacy */ },
        onPendienteMobileImporteChange: function () { /* Legacy */ },
        onOpenProgramacionMobileDialog: function () { /* Legacy */ },
        onCloseProgramacionMobileDialog: function () { /* Legacy */ },

        onRegistrarFacturaPendienteMobile: function () {
            this.onAsignarPendientesContrato();
        },

        onDesasignarPendienteMobile: function () {
            // Legacy — acción de desasignar desde lista mobile
        },

        onRegistrarFacturaPendiente: function () {
            this.onAsignarPendientesContrato();
        },

        onDesasignarPendiente: function () {
            // Legacy — acción mantenida por compatibilidad
        },

        _refreshPosicionesHighlight: function () {
            var oTable = this.byId("posicionesAsignacionTable");
            if (!oTable) { return; }
            oTable.getItems().forEach(function (oItem) {
                var oCtx = oItem.getBindingContext("posiciones");
                if (!oCtx) { return; }
                var oData = oCtx.getObject();
                if (oData && oData.asignado) {
                    oItem.addStyleClass("claro-row-asignado");
                } else {
                    oItem.removeStyleClass("claro-row-asignado");
                }
            });
        },

        _navigateToStep4: function () {
            var oWizard = this.byId("registerWizard");
            var oStep3  = this.byId("wizardStep3");
            var oStep4  = this.byId("wizardStep4");
            if (!oWizard || !oStep3 || !oStep4) { return; }

            // Force validation directly on the WizardStep object so the Wizard
            // sees it as validated regardless of binding propagation timing.
            oStep3.setValidated(true);

            // Determine if step4 is already in the wizard's internal progress path.
            // goToStep works only when the step has been visited before.
            // nextStep works to ADD the step to the path for the first time.
            var aPath = oWizard._aStepPath || [];
            if (aPath.indexOf(oStep4) >= 0) {
                // Step4 already in progress — scroll directly to it
                oWizard.goToStep(oStep4, true);
            } else {
                // First time — advance the wizard which adds step4 to the path
                oWizard.nextStep();
            }
        },

        _refreshPendientesHighlight: function () {
            var oTable = this.byId("pendientesFactTable");
            if (!oTable) { return; }
            var oModel = this.getView().getModel("pendientesFact");
            var aData = oModel.getData() || [];
            var oDomRef = oTable.getDomRef();
            if (!oDomRef) { return; }
            var aRows = oTable.getRows();
            aRows.forEach(function (oRow) {
                var iIdx = oRow.getIndex();
                var oTr = oRow.getDomRef();
                if (!oTr) { return; }
                var oItem = aData[iIdx];
                if (oItem && oItem.asignado) {
                    oTr.classList.add("claro-row-asignado");
                } else {
                    oTr.classList.remove("claro-row-asignado");
                }
            });
        },

        onStep4Activate: function () {
            this._realizarValidacionImportes();
        },

        onCuentaContableValueHelpRequest: function (oEvent) {
            var that = this;
            this._oCuentaContableInput = oEvent.getSource();
            var aCuentas = this._oMockDataService.getCuentasContables();
            this.getView().getModel("cuentasContables").setData(aCuentas);
            this._oCuentaContableMasterData = aCuentas;

            if (!this._oCuentaContableVHDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "claro.com.clarocomprobantes.view.fragment.CuentaContableVH",
                    controller: this
                }).then(function (oDialog) {
                    that._oCuentaContableVHDialog = oDialog;
                    that.getView().addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this._oCuentaContableVHDialog.open();
            }
        },

        onCuentaContableVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
            var aMaster = this._oCuentaContableMasterData || [];
            if (!sValue) {
                this.getView().getModel("cuentasContables").setData(aMaster);
                return;
            }
            var sLower = sValue.toLowerCase();
            this.getView().getModel("cuentasContables").setData(
                aMaster.filter(function (o) {
                    return o.codigo.toLowerCase().indexOf(sLower) !== -1 ||
                           o.descripcion.toLowerCase().indexOf(sLower) !== -1;
                })
            );
        },

        onCuentaContableVHSelect: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oCuenta = oItem.getBindingContext("cuentasContables").getObject();
            if (this._oCuentaContableInput) {
                this._oCuentaContableInput.setValue(oCuenta.codigo);
                var oRowCtx = this._oCuentaContableInput.getBindingContext("pendientesFact");
                if (oRowCtx) {
                    // Desktop table: write to pendientesFact model
                    oRowCtx.getModel().setProperty(oRowCtx.getPath() + "/cuentaContable", oCuenta.codigo);
                    oRowCtx.getModel().setProperty(oRowCtx.getPath() + "/descripcionCtaContable", oCuenta.descripcion);
                } else {
                    // Mobile dialog: write to pendienteMobileEdit model
                    var oEditModel = this.getView().getModel("pendienteMobileEdit");
                    if (oEditModel) {
                        oEditModel.setProperty("/cuentaContable", oCuenta.codigo);
                        oEditModel.setProperty("/descripcionCtaContable", oCuenta.descripcion);
                    }
                }
            }
            this._oCuentaContableVHDialog.close();
        },

        onCuentaContableVHClose: function () {
            this._oCuentaContableVHDialog.close();
        },
        
        onAsignarObligaciones: function () {
            var oTable = this.byId("obligacionesTable");
            var aSelectedItems = oTable.getSelectedItems();
            
            if (aSelectedItems.length === 0) {
                MessageToast.show("Seleccione al menos una obligación");
                return;
            }
            
            var oViewModel = this.getView().getModel("viewModel");
            var aAsignaciones = oViewModel.getProperty("/asignaciones") || [];
            var oDetalle = this.getView().getModel("detalle").getData();
            
            // Agregar las obligaciones seleccionadas a las asignaciones
            aSelectedItems.forEach(function (oItem) {
                var oObligacion = oItem.getBindingContext("obligaciones").getObject();
                
                // Verificar que no esté ya asignada
                var bExists = aAsignaciones.some(function (oAsig) {
                    return oAsig.id === oObligacion.id;
                });
                
                if (!bExists) {
                    var oAsig = Object.assign({}, oObligacion);
                    // Etiquetar con documento de origen (patrón MIRO)
                    oAsig._sourceDoc = oDetalle.numeroDocumento;
                    oAsig._sourceDocType = oDetalle.tipoDocumentoDesc;
                    oAsig._sourceDocId = oDetalle.id;
                    oAsig._sourceDocTipo = oDetalle.tipoDocumento;
                    aAsignaciones.push(oAsig);
                }
            });
            
            oViewModel.setProperty("/asignaciones", aAsignaciones);
            
            // Calcular total asignado
            this._calcularTotalAsignado();
            
            // Deseleccionar items
            oTable.removeSelections(true);
            oViewModel.setProperty("/hasSelectedObligaciones", false);
            
            // Validar step 3
            this._validateStep3();
            
            MessageToast.show(aSelectedItems.length + " obligación(es) asignada(s)");
        },
        
        onPosicionesSelectionChange: function (oEvent) {
            var oTable = this.byId("posicionesAsignacionTable");
            var aSelectedItems = oTable.getSelectedItems();
            
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/hasSelectedPosiciones", aSelectedItems.length > 0);
            oViewModel.setProperty("/countSelectedPosiciones", aSelectedItems.length);
        },
        
        onSelectAllPosiciones: function () {
            var oTable = this.byId("posicionesAsignacionTable");
            var aPosiciones = this.getView().getModel("posiciones").getData();
            
            // Seleccionar solo las pendientes
            var aItems = oTable.getItems();
            aItems.forEach(function (oItem) {
                var oContext = oItem.getBindingContext("posiciones");
                if (oContext) {
                    var oPosicion = oContext.getObject();
                    if (oPosicion.estado === "PENDIENTE") {
                        oTable.setSelectedItem(oItem, true);
                    }
                }
            });
            
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/hasSelectedPosiciones", oTable.getSelectedItems().length > 0);
        },
        
        onAsignarPosiciones: function () {
            var that = this;
            var oTable = this.byId("posicionesAsignacionTable");
            var aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                MessageToast.show("Seleccione al menos una posición");
                return;
            }

            var oViewModel = this.getView().getModel("viewModel");
            var aAsignaciones = oViewModel.getProperty("/asignaciones") || [];
            var oModel = this.getView().getModel("posiciones");
            var oDetalle = this.getView().getModel("detalle").getData();

            aSelectedItems.forEach(function (oItem) {
                var oPosicion = oItem.getBindingContext("posiciones").getObject();

                var bExists = aAsignaciones.some(function (oAsig) {
                    return oAsig.id === oPosicion.id;
                });

                if (!bExists) {
                    // Marcar como asignado para pintar la fila de verde
                    oPosicion.asignado = true;

                    var oAsignacion = Object.assign({}, oPosicion);
                    oAsignacion.montoTotal = oPosicion.importe;
                    // Etiquetar con documento de origen (patrón MIRO)
                    oAsignacion._sourceDoc = oDetalle.numeroDocumento;
                    oAsignacion._sourceDocType = oDetalle.tipoDocumentoDesc;
                    oAsignacion._sourceDocId = oDetalle.id;
                    oAsignacion._sourceDocTipo = oDetalle.tipoDocumento;
                    aAsignaciones.push(oAsignacion);
                }
            });

            oViewModel.setProperty("/asignaciones", aAsignaciones);
            oModel.refresh(true);

            // Limpiar selección
            oTable.removeSelections(true);
            oViewModel.setProperty("/hasSelectedPosiciones", false);
            oViewModel.setProperty("/countSelectedPosiciones", 0);

            this._calcularTotalAsignado();
            this._validateStep3();

            // Actualizar validación de importes y refrescar highlight
            setTimeout(function () {
                that._refreshPosicionesHighlight();
                that._realizarValidacionImportes();
            }, 150);

            MessageToast.show(aSelectedItems.length + " posición(es) asignada(s)");
            if (window.DemoTour) { window.DemoTour.onUserAction("obligacionesAsignadas"); }
        },

        onDesasignarPosiciones: function () {
            var that = this;
            var oTable = this.byId("posicionesAsignacionTable");
            var aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                MessageToast.show("Seleccione posiciones a desasignar");
                return;
            }

            var oViewModel = this.getView().getModel("viewModel");
            var aAsignaciones = oViewModel.getProperty("/asignaciones") || [];
            var oModel = this.getView().getModel("posiciones");

            aSelectedItems.forEach(function (oItem) {
                var oPosicion = oItem.getBindingContext("posiciones").getObject();

                // Quitar el color verde
                oPosicion.asignado = false;

                // Eliminar de la lista de asignaciones
                var iIdx = aAsignaciones.findIndex(function (a) { return a.id === oPosicion.id; });
                if (iIdx >= 0) { aAsignaciones.splice(iIdx, 1); }
            });

            oViewModel.setProperty("/asignaciones", aAsignaciones);
            oModel.refresh(true);

            // Limpiar selección
            oTable.removeSelections(true);
            oViewModel.setProperty("/hasSelectedPosiciones", false);

            this._calcularTotalAsignado();
            this._validateStep3();

            setTimeout(function () {
                that._refreshPosicionesHighlight();
                that._realizarValidacionImportes();
            }, 150);

            MessageToast.show(aSelectedItems.length + " posición(es) desasignada(s)");
        },
        
        onDeleteAsignacion: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            var oContext = oItem.getBindingContext("viewModel");
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.split("/").pop());
            
            var oViewModel = this.getView().getModel("viewModel");
            var aAsignaciones = oViewModel.getProperty("/asignaciones");
            
            aAsignaciones.splice(iIndex, 1);
            oViewModel.setProperty("/asignaciones", aAsignaciones);
            
            this._calcularTotalAsignado();
            this._validateStep3();
            
            MessageToast.show("Asignación eliminada");
        },

        onQuitarAsignacion: function (oEvent) {
            // Soporta tanto mode="Delete" (listItem param) como botón directo (getSource)
            var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
            var oContext = oItem.getBindingContext("viewModel");
            var sPath = oContext.getPath();
            var iIndex = parseInt(sPath.split("/").pop());

            var oViewModel = this.getView().getModel("viewModel");
            var aAsignaciones = oViewModel.getProperty("/asignaciones");
            var oRemoved = aAsignaciones[iIndex];

            // Unmark the position in the posiciones model if it belongs to the current document
            if (oRemoved && this._allPosicionesData) {
                var oFound = this._allPosicionesData.find(function (p) { return p.id === oRemoved.id; });
                if (oFound) {
                    oFound.asignado = false;
                    this.getView().getModel("posiciones").refresh(true);
                }
            }

            aAsignaciones.splice(iIndex, 1);
            oViewModel.setProperty("/asignaciones", aAsignaciones);

            this._calcularTotalAsignado();
            this._validateStep3();
            this._realizarValidacionImportes();

            // Refrescar highlight de posiciones
            var that = this;
            setTimeout(function () { that._refreshPosicionesHighlight(); }, 100);

            MessageToast.show("Asignación eliminada");
        },

        /**
         * Click en el link Doc. Origen de la tabla de asignaciones.
         * Busca el documento en los resultados de búsqueda, lo selecciona visualmente,
         * carga sus posiciones y hace scroll a la sección correspondiente.
         */
        onAsignacionDocClick: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("viewModel");
            var oAsig = oContext.getObject();
            var sNumeroDoc = oAsig._sourceDoc;
            var sTipoDoc = oAsig._sourceDocTipo;

            // Buscar el documento en los resultados de búsqueda actuales
            var aResults = this._allSearchResults || [];
            var oDoc = aResults.find(function (d) {
                return d.numeroDocumento === sNumeroDoc && d.tipoDocumento === sTipoDoc;
            });

            if (!oDoc) {
                MessageToast.show("Documento " + sNumeroDoc + " no encontrado en los resultados de búsqueda");
                return;
            }

            // Navegar a la página correcta
            var iPageSize = this._iSearchPageSize || 10;
            var iDocIndex = aResults.indexOf(oDoc);
            var iTargetPage = Math.floor(iDocIndex / iPageSize) + 1;
            this._applySearchResultsPagination(iTargetPage);

            // Cargar las posiciones del documento
            var that = this;
            setTimeout(function () {
                that._selectDocument(oDoc);
            }, 150);
        },
        
        _calcularTotalAsignado: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var aAsignaciones = oViewModel.getProperty("/asignaciones") || [];
            
            var fTotal = aAsignaciones.reduce(function (fSum, oAsig) {
                return fSum + (oAsig.montoTotal || oAsig.importe || 0);
            }, 0);
            
            oViewModel.setProperty("/totalAsignado", fTotal);
            oViewModel.setProperty("/asignacionesCount", aAsignaciones.length);
            this._updateAsignacionesResumen();
        },
        
        _validateStep3: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var aAsignaciones = oViewModel.getProperty("/asignaciones") || [];
            
            var bValid = aAsignaciones.length > 0;
            oViewModel.setProperty("/step3Valid", bValid);
            
            // Si es válido, realizar validación de importes
            if (bValid) {
                this._realizarValidacionImportes();
            }
            
            return bValid;
        },
        
        _realizarValidacionImportes: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var oComprobante = this.getView().getModel("comprobante").getData();
            var aAsignaciones = oViewModel.getProperty("/asignaciones") || [];

            // Compute assigned totals — supports both pendientesFact fields (valorVenta/igv/inafecto/total)
            // and OC/Póliza fields (importeObligacion/montoIGV/montoInafecto/montoTotal)
            var fBase = 0, fIGV = 0, fInafecto = 0, fTotal = 0;
            aAsignaciones.forEach(function (o) {
                fBase     += (parseFloat(o.valorVenta)    || parseFloat(o.importeObligacion) || parseFloat(o.importe) || 0);
                fIGV      += (parseFloat(o.igv)           || parseFloat(o.montoIGV)          || 0);
                fInafecto += (parseFloat(o.inafecto)      || parseFloat(o.montoInafecto)     || 0);
                fTotal    += (parseFloat(o.total)         || parseFloat(o.montoTotal)        || parseFloat(o.importe) || 0);
            });

            var fXmlBase     = oComprobante.importeBase    || 0;
            var fXmlIGV      = oComprobante.montoIGV       || 0;
            var fXmlInafecto = oComprobante.montoInafecto  || 0;
            var fXmlTotal    = oComprobante.montoTotal      || 0;
            var fTolerance   = 1.00;

            var aComparacion = [
                { campo: "Importe Base",   xml: fXmlBase,     asignado: fBase,     diferencia: fXmlBase     - fBase     },
                { campo: "Monto IGV",      xml: fXmlIGV,      asignado: fIGV,      diferencia: fXmlIGV      - fIGV      },
                { campo: "Monto Inafecto", xml: fXmlInafecto, asignado: fInafecto, diferencia: fXmlInafecto - fInafecto },
                { campo: "Monto Total",    xml: fXmlTotal,    asignado: fTotal,    diferencia: fXmlTotal    - fTotal    }
            ];

            var bValid = aComparacion.every(function (r) { return Math.abs(r.diferencia) <= fTolerance; });

            oViewModel.setProperty("/validacionOk", bValid);
            oViewModel.setProperty("/validacionMessage", bValid
                ? "Los importes coinciden dentro de la tolerancia permitida"
                : "Existen diferencias entre los importes del XML y las asignaciones que exceden la tolerancia de S/ " + fTolerance.toFixed(2));
            oViewModel.setProperty("/comparacion", aComparacion);
            oViewModel.setProperty("/step4Valid", bValid);
            oViewModel.setProperty("/canRegister", bValid);
            oViewModel.setProperty("/canSubmit", bValid);
        },
        
        onWizardComplete: function () {
            MessageToast.show("Wizard completado");
        },

        // ── Popup Resumen Final ────────────────────────────────────────────────
        onFinalizarRegistro: function () {
            var that = this;
            var oViewModel = this.getView().getModel("viewModel");
            var aAsignaciones = oViewModel.getProperty("/asignaciones") || [];

            // Calcular agregados
            var oDistinctDocs = {}; // { numeroOC: { numero, descripcion } }
            var fMontoAsignado = 0;
            aAsignaciones.forEach(function (oAsig) {
                var sKey = oAsig._sourceDoc || "Sin documento";
                if (!oDistinctDocs[sKey]) {
                    // Buscar la descripción real de la OC para evitar redundancia en el popover
                    var oOCData = that._oMockDataService.getOrdenCompraByNumero(sKey);
                    oDistinctDocs[sKey] = {
                        numero: sKey,
                        descripcion: oOCData ? oOCData.descripcion : (oAsig._sourceDocType || "Orden de Compra")
                    };
                }
                fMontoAsignado += (oAsig.montoTotal || oAsig.importe || oAsig.total || 0);
            });

            var aDocsList = Object.values(oDistinctDocs);
            var nDocs = aDocsList.length;

            // Smart Truncation: ≤3 → texto plano, 4+ → link con popover
            var bEsLink = nDocs > 3;
            var sResumenLabel = bEsLink
                ? nDocs + " Órdenes de Compra"
                : aDocsList.map(function (d) { return d.numero; }).join(", ");

            oViewModel.setProperty("/resumenDocsCount", nDocs);
            oViewModel.setProperty("/resumenPosCount", aAsignaciones.length);
            oViewModel.setProperty("/resumenMontoAsignado",
                fMontoAsignado.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            oViewModel.setProperty("/documentosOrigenResumen", sResumenLabel);
            oViewModel.setProperty("/documentosOrigenEsLink", bEsLink);
            oViewModel.setProperty("/documentosOrigenLista", aDocsList);

            if (!this._oResumenFinalDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "claro.com.clarocomprobantes.view.fragment.ResumenFinalDialog",
                    controller: this
                }).then(function (oDialog) {
                    that._oResumenFinalDialog = oDialog;
                    that.getView().addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this._oResumenFinalDialog.open();
            }
        },

        onOrigenDocsLinkPress: function (oEvent) {
            var oLink = oEvent.getSource();
            var oView = this.getView();
            // Buscar el popover dentro del dialog (dependents del dialog)
            var oPopover = oView.byId("popOrigenDocs") ||
                (this._oResumenFinalDialog && this._oResumenFinalDialog.byId &&
                    sap.ui.getCore().byId(oView.getId() + "--popOrigenDocs"));
            if (oPopover) {
                // Bindear la lista al modelo viewModel del owner component
                oPopover.setModel(oView.getModel("viewModel"), "viewModel");
                oPopover.openBy(oLink);
            }
        },

        onResumenDialogCancelar: function () {
            if (this._oResumenFinalDialog) {
                this._oResumenFinalDialog.close();
            }
        },

        onResumenDialogRegistrar: function () {
            if (this._oResumenFinalDialog) {
                this._oResumenFinalDialog.close();
            }
            this.onRegistrar();
        },

        onResumenDialogRegistrarYEnviar: function () {
            if (this._oResumenFinalDialog) {
                this._oResumenFinalDialog.close();
            }
            this.onRegistrarYEnviar();
        },

        onRegistrar: function () {
            this._guardarComprobante("REGISTRADO");
        },

        onRegistrarYEnviar: function () {
            var that = this;
            var oComprobante = this.getView().getModel("comprobante").getData();
            var sFactura = (oComprobante.serieDocumento || "") + "-" + (oComprobante.numeroDocumento || "");
            MessageBox.warning(
                "La factura " + sFactura + " será enviada a la bandeja de contabilización.\n\nEsta acción no se puede deshacer. ¿Desea continuar?",
                {
                    title: "Confirmar Envío a Contabilización",
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            that._guardarComprobante("ENVIADO");
                        }
                    }
                }
            );
        },
        
        _guardarComprobante: function (sEstado) {
            var that = this;
            var oViewModel = this.getView().getModel("viewModel");
            var oComprobante = this.getView().getModel("comprobante").getData();
            var oDetalle = this.getView().getModel("detalle").getData();
            var aAsignaciones = oViewModel.getProperty("/asignaciones");
            
            oViewModel.setProperty("/busy", true);
            
            // Preparar datos del comprobante
            var oNuevoComprobante = Object.assign({}, oComprobante);
            oNuevoComprobante.estado = sEstado;
            oNuevoComprobante.estadoDesc = sEstado === "ENVIADO" ? "Enviado" : "Registrado";
            oNuevoComprobante.documentoOrigen = {
                tipo: oDetalle.tipoDocumento,
                numero: oDetalle.numeroDocumento
            };
            
            // Asignar IDs y detalle de periodos según tipo de documento
            if (oDetalle.tipoDocumento === "CONTRATO") {
                oNuevoComprobante.obligacionesAsignadas = aAsignaciones.map(function (o) { return o.id; });
                oNuevoComprobante.periodosFacturados = aAsignaciones.map(function (o) {
                    return {
                        id: o.id,
                        mesPago: o.mesPago,
                        fechaInicio: o.fechaInicio,
                        fechaFin: o.fechaFin,
                        conceptoPago: o.conceptoPago,
                        valorVenta: o.valorVenta,
                        igv: o.igv,
                        total: o.total
                    };
                });
                oNuevoComprobante.posicionesAsignadas = [];
            } else {
                oNuevoComprobante.obligacionesAsignadas = [];
                oNuevoComprobante.periodosFacturados = [];
                oNuevoComprobante.posicionesAsignadas = aAsignaciones.map(function (o) { return o.id; });
            }
            
            // Información de archivos
            oNuevoComprobante.archivos = {
                xml: oViewModel.getProperty("/xmlFileName"),
                pdf: oViewModel.getProperty("/pdfFileName"),
                cdr: oViewModel.getProperty("/cdrFileName") || null,
                otros: oViewModel.getProperty("/otrosArchivos").map(function (o) { return o.name; })
            };
            
            // Datos de auditoría
            oNuevoComprobante.fechaCreacion = new Date().toISOString();
            oNuevoComprobante.usuarioCreacion = this._oMockDataService.getUsuarioActual().email;
            
            // Simular guardado
            setTimeout(function () {
                that._oMockDataService.saveComprobante(oNuevoComprobante);
                if (sEstado === "ENVIADO" && window.DemoTour) { window.DemoTour.onUserAction("comprobanteEnviado"); }

                oViewModel.setProperty("/busy", false);
                // Mark as registered so onNavBack skips the unsaved-data warning
                oViewModel.setProperty("/registrationComplete", true);

                var oComp = that.getView().getModel("comprobante").getData();
                var sPeriodo = (oComp.periodoMes || "") + "-" + (oComp.periodoAnio || "");
                var sFactura = (oComp.serieDocumento || "") + "-" + (oComp.numeroDocumento || "");
                var sMessage = sEstado === "ENVIADO"
                    ? "La factura " + sFactura + " fue registrada y enviada exitosamente.\n" +
                      "Periodo: " + sPeriodo + "\nHa sido remitida a la bandeja de contabilización."
                    : "La factura " + sFactura + " fue registrada exitosamente.\n" +
                      "Periodo: " + sPeriodo;

                MessageBox.success(sMessage, {
                    title: sEstado === "ENVIADO" ? "Registrado y Enviado" : "Registro Exitoso",
                    onClose: function () {
                        // Reinicializar wizard al paso 1 en lugar de navegar
                        that._sDocumentId = null;
                        that._sTipoDocumento = null;
                        that._sNumeroDocumento = null;
                        that._sComprobanteId = null;
                        that._sMode = "new";
                        that._resetState();
                        that._loadData();
                    }
                });
            }, 1000);
        },
        
        onCancel: function () {
            var that = this;
            var oBundle = this.getView().getModel("i18n").getResourceBundle();
            
            MessageBox.confirm(oBundle.getText("confirmarCancelar"), {
                title: oBundle.getText("confirmacion"),
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        that.onNavBack();
                    }
                }
            });
        },
        
        onNavToList: function () {
            this.getOwnerComponent().getRouter().navTo("RouteRegisterVoucher");
        },

        onNavBack: function () {
            var that = this;
            var oViewModel = this.getView().getModel("viewModel");
            var fnNavigate = function () {
                // If we came from a document context, go back to that document detail
                if (that._sDocumentId) {
                    that.getOwnerComponent().getRouter().navTo("RouteDocumentDetail", {
                        documentId: that._sDocumentId,
                        tipoDocumento: that._sTipoDocumento,
                        numeroDocumento: that._sNumeroDocumento
                    });
                } else {
                    that.getOwnerComponent().getRouter().navTo("RouteRegisterVoucher");
                }
            };
            if (oViewModel.getProperty("/readOnly") || oViewModel.getProperty("/registrationComplete")) {
                fnNavigate();
                return;
            }
            MessageBox.confirm(
                "¿Está seguro de navegar a otra página? Se perderán los datos ingresados.",
                {
                    title: "Confirmar navegación",
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.CANCEL,
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            fnNavigate();
                        }
                    }
                }
            );
        },

        onWizardComplete: function () {
            // El wizard completó todos los pasos — en modo edición habilitar acciones finales
            var oViewModel = this.getView().getModel("viewModel");
            if (!oViewModel.getProperty("/readOnly")) {
                MessageToast.show("Todos los pasos completados. Puede Registrar o Registrar y Enviar el comprobante.");
            }
        },

        /* ─────────────── STEP NAVIGATION (legacy — Wizard handles this) ─────────────── */
        onStepSelect: function () { /* handled by sap.m.Wizard */ },
        onNextStep: function () { /* handled by sap.m.Wizard */ },
        onPrevStep: function () { /* handled by sap.m.Wizard */ },

        onExit: function () {
            if (this._fnResizeHandler) {
                window.removeEventListener("resize", this._fnResizeHandler);
            }
        }
    });
});
