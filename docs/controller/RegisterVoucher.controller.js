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
                filterEstadoPosicion: "",
                hasSelectedObligaciones: false,
                hasSelectedPosiciones: false,
                hasSelectedPendientes: false,
                posicionesPage: 1,
                posicionesTotalPages: 1,
                posicionesTotal: 0,
                registrationComplete: false,
                asignaciones: [],
                totalAsignado: 0,
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
            oRouter.getRoute("RouteVoucherDetail").attachPatternMatched(this._onVoucherDetailMatched, this);
        },
        
        _onNewVoucherMatched: function (oEvent) {
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
                filterEstadoPosicion: "",
                hasSelectedObligaciones: false,
                hasSelectedPosiciones: false,
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
                validacionOk: false,
                validacionMessage: "",
                comparacion: [],
                currentStep: 1,
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
                posMobilePageInfo: "Pag 1 de 1 | 0 Reg.",
                progDesktopPage: 1,
                progDesktopTotalPages: 1,
                progDesktopTotal: 0,
                pendDesktopPage: 1,
                pendDesktopTotalPages: 1,
                pendDesktopTotal: 0
            });

            // Reset datos auxiliares
            this._allPosicionesData = [];
            this._allProgramacionData = [];
            this._allPendientesData = [];

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
                
                // Cargar detalle del documento
                that._loadDocumentDetail();
                
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
            }
        },
        
        _loadOrdenCompraData: function (sNumeroOC) {
            var oOrdenCompra = this._oMockDataService.getOrdenCompraByNumero(sNumeroOC);
            if (oOrdenCompra) {
                // Filtrar solo posiciones pendientes por defecto
                var aPosiciones = oOrdenCompra.posiciones.filter(function (oPos) {
                    return oPos.estado === "PENDIENTE";
                });
                // Limpiar flag asignado de sesiones anteriores
                aPosiciones.forEach(function (oPos) { oPos.asignado = false; });
                this._allPosicionesData = aPosiciones;
                this._applyPosicionesPagination(1);
            }
        },
        
        _loadPolizaData: function (sNumeroPoliza) {
            var oPoliza = this._oMockDataService.getPolizaByNumero(sNumeroPoliza);
            if (oPoliza) {
                var aPosiciones = oPoliza.posiciones.filter(function (oPos) {
                    return oPos.estado === "PENDIENTE";
                });
                aPosiciones.forEach(function (oPos) { oPos.asignado = false; });
                this._allPosicionesData = aPosiciones;
                this._applyPosicionesPagination(1);
            }
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
            this.getView().getModel("viewModel").setProperty("/hasSelectedPosiciones", aSelected.length > 0);
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

            aSelected.forEach(function (oItem) {
                var oPos = oItem.getBindingContext("posicionesPaged").getObject();
                oPos.asignado = true;
                // Sync back to _allPosicionesData
                var oOrig = that._allPosicionesData.find(function (p) { return p.id === oPos.id; });
                if (oOrig) { oOrig.asignado = true; }

                var bExists = aAsignaciones.some(function (a) { return a.id === oPos.id; });
                if (!bExists) {
                    var oAsig = Object.assign({}, oPos);
                    oAsig.montoTotal = oPos.importe;
                    aAsignaciones.push(oAsig);
                }
            });

            oViewModel.setProperty("/asignaciones", aAsignaciones);
            this.getView().getModel("posicionesPaged").refresh(true);
            // Refresh desktop table too
            this.getView().getModel("posiciones").refresh(true);

            oList.removeSelections(true);
            oViewModel.setProperty("/hasSelectedPosiciones", false);

            this._calcularTotalAsignado();
            this._validateStep3();

            setTimeout(function () {
                that._realizarValidacionImportes();
                that._navigateToStep4();
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
                oPos.asignado = false;
                var oOrig = that._allPosicionesData.find(function (p) { return p.id === oPos.id; });
                if (oOrig) { oOrig.asignado = false; }

                var iIdx = aAsignaciones.findIndex(function (a) { return a.id === oPos.id; });
                if (iIdx >= 0) { aAsignaciones.splice(iIdx, 1); }
            });

            oViewModel.setProperty("/asignaciones", aAsignaciones);
            this.getView().getModel("posicionesPaged").refresh(true);
            this.getView().getModel("posiciones").refresh(true);

            oList.removeSelections(true);
            oViewModel.setProperty("/hasSelectedPosiciones", false);

            this._calcularTotalAsignado();
            this._validateStep3();

            setTimeout(function () {
                that._realizarValidacionImportes();
                that._navigateToStep4();
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
                // Poblar tabla de Pendientes por Facturar con las obligaciones ya asignadas
                var aObligaciones = oComprobante.obligacionesAsignadas || [];
                this._allPendientesData = aObligaciones.length > 0 ? aObligaciones : [];
                this._applyPendDesktopPage(1);

                // Cargar la programación del primer concepto del contrato
                var oContrato = this.getView().getModel("contrato").getData();
                if (oContrato && oContrato.id && oContrato.conceptos && oContrato.conceptos.length > 0) {
                    var sConceptoId   = oContrato.conceptos[0].id;
                    var aProgramacion = this._oMockDataService.getObligacionesProgramacion(oContrato.id, sConceptoId);
                    this._allProgramacionData = aProgramacion;
                    this._applyProgDesktopPage(1);
                    this.getView().getModel("viewModel").setProperty("/selectedConceptoId", sConceptoId);
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
        
        onConceptoChange: function (oEvent) {
            var sConceptoId = oEvent.getSource().getSelectedKey();
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/selectedConceptoId", sConceptoId);
        },
        
        onAgregarConcepto: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var sConceptoId = oViewModel.getProperty("/selectedConceptoId");
            
            if (!sConceptoId) {
                MessageToast.show("Seleccione un concepto");
                return;
            }
            
            // Obtener contrato del modelo
            var oContrato = this.getView().getModel("contrato").getData();

            // Tabla 1: Cargar programación de obligaciones
            var aProgramacion = this._oMockDataService.getObligacionesProgramacion(oContrato.id, sConceptoId);
            this._allProgramacionData = aProgramacion;
            this._applyProgDesktopPage(1);

            // Tabla 2: Cargar pendientes por facturar
            var aPendientes = this._oMockDataService.getPendientesFact(oContrato.id, sConceptoId);
            this._allPendientesData = aPendientes;
            this._applyPendDesktopPage(1);
            oViewModel.setProperty("/hasSelectedPendientes", false);

            if (aProgramacion.length === 0 && aPendientes.length === 0) {
                MessageToast.show("No hay datos para el concepto seleccionado");
            }
        },
        
        onObligacionesSelectionChange: function (oEvent) {
            var oTable = this.byId("obligacionesTable");
            var aSelectedItems = oTable ? oTable.getSelectedItems() : [];
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/hasSelectedObligaciones", aSelectedItems.length > 0);
        },

        onPendientesFactSelectionChange: function () {
            var oTable = this.byId("pendientesFactTable");
            var aIndices = oTable ? oTable.getSelectedIndices() : [];
            this.getView().getModel("viewModel").setProperty("/hasSelectedPendientes", aIndices.length > 0);
        },

        onPendienteImporteChange: function (oEvent) {
            var oInput = oEvent.getSource();
            var sLiveValue = oEvent.getParameter("value") || "";
            var oCtx = oInput.getBindingContext("pendientesFact");
            if (!oCtx) { return; }
            var oModel = this.getView().getModel("pendientesFact");
            // liveChange fires before two-way binding updates the model,
            // so we read the live value from the event and the OTHER field from model.
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

        // ── Mobile Pendientes (Option B: List + Edit Dialog) ─────────────────────

        onPendientesFactMobileSelectionChange: function () {
            var oList = this.byId("pendientesFactMobileList");
            var aSelected = oList ? oList.getSelectedItems() : [];
            this.getView().getModel("viewModel").setProperty("/hasSelectedPendientes", aSelected.length > 0);
        },

        onOpenPendienteMobileDialog: function (oEvent) {
            var that = this;
            var oItem = oEvent.getSource();
            var oCtx = oItem.getBindingContext("pendientesFactPaged");
            if (!oCtx) { return; }
            var oPagedObj = oCtx.getObject();
            this._sPendienteMobileEditPath = "/" + oPagedObj._origIdx;
            // Deep copy into edit model so original is not touched until Confirm
            var oData = JSON.parse(JSON.stringify(oPagedObj));
            if (!this.getView().getModel("pendienteMobileEdit")) {
                this.getView().setModel(new JSONModel(oData), "pendienteMobileEdit");
            } else {
                this.getView().getModel("pendienteMobileEdit").setData(oData);
            }
            if (!this._oPendienteMobileDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "claro.com.clarocomprobantes.view.fragment.PendienteMobileEditDialog",
                    controller: this
                }).then(function (oDialog) {
                    that._oPendienteMobileDialog = oDialog;
                    that.getView().addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this._oPendienteMobileDialog.open();
            }
        },

        onConfirmPendienteMobileDialog: function () {
            var oEditModel = this.getView().getModel("pendienteMobileEdit");
            var oModel    = this.getView().getModel("pendientesFact");
            var sPath     = this._sPendienteMobileEditPath;
            var oData     = oEditModel.getData();
            ["valorVenta", "igv", "inafecto", "total", "cuentaContable", "descripcionCtaContable"].forEach(function (sField) {
                oModel.setProperty(sPath + "/" + sField, oData[sField]);
            });
            this._oPendienteMobileDialog.close();
            // Refrescar la página paginada para reflejar cambios
            this._applyPendMobilePage(this.getView().getModel("viewModel").getProperty("/pendMobilePage"));
            MessageToast.show("Datos actualizados");
        },

        onCancelPendienteMobileDialog: function () {
            this._oPendienteMobileDialog.close();
        },

        onPendienteMobileImporteChange: function (oEvent) {
            var oInput     = oEvent.getSource();
            var sLiveValue = oEvent.getParameter("value") || "";
            var oEditModel = this.getView().getModel("pendienteMobileEdit");
            var sPath      = oInput.getBinding("value") ? oInput.getBinding("value").getPath() : "";
            var fValorVenta, fIGV;
            if (sPath === "/valorVenta") {
                fValorVenta = parseFloat(sLiveValue) || 0;
                fIGV        = parseFloat(oEditModel.getProperty("/igv")) || 0;
            } else {
                fValorVenta = parseFloat(oEditModel.getProperty("/valorVenta")) || 0;
                fIGV        = parseFloat(sLiveValue) || 0;
            }
            oEditModel.setProperty("/total", parseFloat((fValorVenta + fIGV).toFixed(2)));
        },

        // ── Mobile Programación Dialog (solo lectura) ─────────────────────────

        onOpenProgramacionMobileDialog: function (oEvent) {
            var that = this;
            var oCtx = oEvent.getSource().getBindingContext("programacionPaged");
            if (!oCtx) { return; }
            var oData = JSON.parse(JSON.stringify(oCtx.getObject()));
            if (!this.getView().getModel("programacionMobileDetail")) {
                this.getView().setModel(new JSONModel(oData), "programacionMobileDetail");
            } else {
                this.getView().getModel("programacionMobileDetail").setData(oData);
            }
            if (!this._oProgramacionMobileDialog) {
                sap.ui.core.Fragment.load({
                    id: this.getView().getId(),
                    name: "claro.com.clarocomprobantes.view.fragment.ProgramacionMobileDialog",
                    controller: this
                }).then(function (oDialog) {
                    that._oProgramacionMobileDialog = oDialog;
                    that.getView().addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this._oProgramacionMobileDialog.open();
            }
        },

        onCloseProgramacionMobileDialog: function () {
            this._oProgramacionMobileDialog.close();
        },

        onRegistrarFacturaPendienteMobile: function () {
            var that = this;
            var oList = this.byId("pendientesFactMobileList");
            var aSelected = oList ? oList.getSelectedItems() : [];
            if (aSelected.length === 0) {
                MessageToast.show("Seleccione al menos un registro pendiente");
                return;
            }
            aSelected.forEach(function (oItem) {
                var oCtx = oItem.getBindingContext("pendientesFactPaged");
                if (oCtx) {
                    var iOrigIdx = oCtx.getObject()._origIdx;
                    if (that._allPendientesData[iOrigIdx]) {
                        that._allPendientesData[iOrigIdx].asignado = true;
                    }
                }
            });
            oList.removeSelections();
            var aAsig = this._allPendientesData.filter(function (o) { return !!o.asignado; });
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/hasSelectedPendientes", false);
            oViewModel.setProperty("/asignaciones", aAsig);
            oViewModel.setProperty("/step3Valid", true);
            this._applyPendDesktopPage(oViewModel.getProperty("/pendDesktopPage"));
            this._applyPendMobilePage(oViewModel.getProperty("/pendMobilePage"));
            setTimeout(function () {
                that._realizarValidacionImportes();
                that._navigateToStep4();
            }, 150);
            MessageToast.show(aAsig.length + " registro(s) asignado(s)");
        },

        onDesasignarPendienteMobile: function () {
            var that = this;
            var oList = this.byId("pendientesFactMobileList");
            var aSelected = oList ? oList.getSelectedItems() : [];
            if (aSelected.length === 0) {
                MessageToast.show("Seleccione los registros a desasignar");
                return;
            }
            aSelected.forEach(function (oItem) {
                var oCtx = oItem.getBindingContext("pendientesFactPaged");
                if (oCtx) {
                    var iOrigIdx = oCtx.getObject()._origIdx;
                    if (that._allPendientesData[iOrigIdx]) {
                        that._allPendientesData[iOrigIdx].asignado = false;
                    }
                }
            });
            oList.removeSelections();
            var aAsig = this._allPendientesData.filter(function (o) { return !!o.asignado; });
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/hasSelectedPendientes", false);
            oViewModel.setProperty("/asignaciones", aAsig);
            oViewModel.setProperty("/step3Valid", aAsig.length > 0);
            this._applyPendDesktopPage(oViewModel.getProperty("/pendDesktopPage"));
            this._applyPendMobilePage(oViewModel.getProperty("/pendMobilePage"));
            setTimeout(function () {
                that._realizarValidacionImportes();
                that._navigateToStep4();
            }, 150);
            MessageToast.show(aSelected.length + " registro(s) desasignado(s)");
        },

        onRegistrarFacturaPendiente: function () {
            var that = this;
            // Sync current page edits (Input fields) back to master data
            this._syncPendDesktopBack();
            var oTable = this.byId("pendientesFactTable");
            var aIndices = oTable ? oTable.getSelectedIndices() : [];
            if (aIndices.length === 0) {
                MessageToast.show("Seleccione al menos un registro pendiente");
                return;
            }

            // Mark rows as assigned in the paged model
            var oModel = this.getView().getModel("pendientesFact");
            var oViewModel = this.getView().getModel("viewModel");
            var iDesktopPage = oViewModel.getProperty("/pendDesktopPage");
            var iPageSize = 10;
            var iOffset = (iDesktopPage - 1) * iPageSize;

            aIndices.forEach(function (iIdx) {
                var oCtx = oTable.getContextByIndex(iIdx);
                if (oCtx) {
                    oModel.setProperty(oCtx.getPath() + "/asignado", true);
                    // Sync back to full data array
                    var iGlobalIdx = iOffset + iIdx;
                    if (that._allPendientesData[iGlobalIdx]) {
                        that._allPendientesData[iGlobalIdx].asignado = true;
                    }
                }
            });

            // Accumulate ALL assigned rows from full dataset
            var aAsignaciones = this._allPendientesData.filter(function (o) { return !!o.asignado; });

            oTable.clearSelection();
            oViewModel.setProperty("/hasSelectedPendientes", false);
            oViewModel.setProperty("/asignaciones", aAsignaciones);
            oViewModel.setProperty("/step3Valid", true);

            setTimeout(function () {
                that._refreshPendientesHighlight();
                that._realizarValidacionImportes();
                that._navigateToStep4();
            }, 150);

            MessageToast.show(aAsignaciones.length + " registro(s) asignado(s)");
        },

        onDesasignarPendiente: function () {
            var that = this;
            this._syncPendDesktopBack();
            var oTable = this.byId("pendientesFactTable");
            var aIndices = oTable ? oTable.getSelectedIndices() : [];
            if (aIndices.length === 0) {
                MessageToast.show("Seleccione los registros a desasignar");
                return;
            }
            var oModel = this.getView().getModel("pendientesFact");
            var oViewModel = this.getView().getModel("viewModel");
            var iDesktopPage = oViewModel.getProperty("/pendDesktopPage");
            var iPageSize = 10;
            var iOffset = (iDesktopPage - 1) * iPageSize;

            aIndices.forEach(function (iIdx) {
                var oCtx = oTable.getContextByIndex(iIdx);
                if (oCtx) {
                    oModel.setProperty(oCtx.getPath() + "/asignado", false);
                    // Sync back to full data array
                    var iGlobalIdx = iOffset + iIdx;
                    if (that._allPendientesData[iGlobalIdx]) {
                        that._allPendientesData[iGlobalIdx].asignado = false;
                    }
                }
            });
            oTable.clearSelection();
            oViewModel.setProperty("/hasSelectedPendientes", false);

            // Recalculate asignaciones from full dataset
            var aAsig = this._allPendientesData.filter(function (o) { return !!o.asignado; });
            oViewModel.setProperty("/asignaciones", aAsig);
            oViewModel.setProperty("/step3Valid", aAsig.length > 0);

            setTimeout(function () {
                that._refreshPendientesHighlight();
                that._realizarValidacionImportes();
                that._navigateToStep4();
            }, 150);

            MessageToast.show(aIndices.length + " registro(s) desasignado(s)");
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
            
            // Agregar las obligaciones seleccionadas a las asignaciones
            aSelectedItems.forEach(function (oItem) {
                var oObligacion = oItem.getBindingContext("obligaciones").getObject();
                
                // Verificar que no esté ya asignada
                var bExists = aAsignaciones.some(function (oAsig) {
                    return oAsig.id === oObligacion.id;
                });
                
                if (!bExists) {
                    aAsignaciones.push(Object.assign({}, oObligacion));
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
        
        onFilterPosicionesChange: function (oEvent) {
            var sEstado = oEvent.getSource().getSelectedKey();
            var oDetalle = this.getView().getModel("detalle").getData();

            var aPosicionesAll = [];

            if (oDetalle.tipoDocumento === "OC") {
                var oOrdenCompra = this._oMockDataService.getOrdenCompraByNumero(oDetalle.numeroDocumento);
                if (oOrdenCompra) { aPosicionesAll = oOrdenCompra.posiciones; }
            } else if (oDetalle.tipoDocumento === "POLIZA" || oDetalle.tipoDocumento === "Póliza") {
                var oPoliza = this._oMockDataService.getPolizaByNumero(oDetalle.numeroDocumento);
                if (oPoliza) { aPosicionesAll = oPoliza.posiciones; }
            }

            // Aplicar filtro
            if (sEstado) {
                this._allPosicionesData = aPosicionesAll.filter(function (oPos) {
                    return oPos.estado === sEstado;
                });
            } else {
                this._allPosicionesData = aPosicionesAll.slice();
            }

            this._applyPosicionesPagination(1);
        },
        
        onPosicionesSelectionChange: function (oEvent) {
            var oTable = this.byId("posicionesAsignacionTable");
            var aSelectedItems = oTable.getSelectedItems();
            
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/hasSelectedPosiciones", aSelectedItems.length > 0);
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

            aSelectedItems.forEach(function (oItem) {
                var oPosicion = oItem.getBindingContext("posiciones").getObject();

                // Marcar como asignado para que el binding de clase aplique el color verde
                oPosicion.asignado = true;

                // También actualizar en _allPosicionesData si la referencia es la misma
                var bExists = aAsignaciones.some(function (oAsig) {
                    return oAsig.id === oPosicion.id;
                });

                if (!bExists) {
                    var oAsignacion = Object.assign({}, oPosicion);
                    oAsignacion.montoTotal = oPosicion.importe;
                    aAsignaciones.push(oAsignacion);
                }
            });

            oViewModel.setProperty("/asignaciones", aAsignaciones);

            // Forzar refresco del binding de clase en las filas de la página actual
            oModel.refresh(true);

            // Limpiar selección
            oTable.removeSelections(true);
            oViewModel.setProperty("/hasSelectedPosiciones", false);

            this._calcularTotalAsignado();
            this._validateStep3();

            // Navegar al paso 4 (Validación y Registro) y actualizar comparación
            setTimeout(function () {
                that._refreshPosicionesHighlight();
                that._realizarValidacionImportes();
                that._navigateToStep4();
            }, 150);

            MessageToast.show(aSelectedItems.length + " posición(es) asignada(s)");
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

            // Navegar al paso 4 y actualizar comparación en caliente
            setTimeout(function () {
                that._refreshPosicionesHighlight();
                that._realizarValidacionImportes();
                that._navigateToStep4();
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
        
        _calcularTotalAsignado: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var aAsignaciones = oViewModel.getProperty("/asignaciones") || [];
            
            var fTotal = aAsignaciones.reduce(function (fSum, oAsig) {
                return fSum + (oAsig.montoTotal || oAsig.importe || 0);
            }, 0);
            
            oViewModel.setProperty("/totalAsignado", fTotal);
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
        
        onRegistrar: function () {
            var that = this;
            var oViewModel = this.getView().getModel("viewModel");
            var oComprobante = this.getView().getModel("comprobante").getData();
            var aAsignaciones = oViewModel.getProperty("/asignaciones") || [];
            var sPeriodo = (oComprobante.periodoMes || "") + "-" + (oComprobante.periodoAnio || "");
            var sLineas = aAsignaciones.map(function (o) {
                return "\u2022 " + (o.mesPago || o.descripcion || o.id || "") +
                       "  |  Total: " + parseFloat(o.total || o.importe || 0).toFixed(2);
            }).join("\n");
            var sMensaje =
                "Se registrará la factura " +
                (oComprobante.serieDocumento || "") + "-" + (oComprobante.numeroDocumento || "") +
                " con estado \u201CREGISTRADO\u201D.\n\n" +
                "Periodo asociado: " + sPeriodo + "\n" +
                "Asignaciones (" + aAsignaciones.length + "):\n" + sLineas +
                "\n\nLa factura quedará guardada en el sistema con esta información.\n¿Desea continuar?";
            MessageBox.confirm(sMensaje, {
                title: "Confirmar Registro",
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        that._guardarComprobante("REGISTRADO");
                    }
                }
            });
        },

        onRegistrarYEnviar: function () {
            var that = this;
            var oViewModel = this.getView().getModel("viewModel");
            var oComprobante = this.getView().getModel("comprobante").getData();
            var aAsignaciones = oViewModel.getProperty("/asignaciones") || [];
            var sPeriodo = (oComprobante.periodoMes || "") + "-" + (oComprobante.periodoAnio || "");
            var sLineas = aAsignaciones.map(function (o) {
                return "\u2022 " + (o.mesPago || o.descripcion || o.id || "") +
                       "  |  Total: " + parseFloat(o.total || o.importe || 0).toFixed(2);
            }).join("\n");
            var sMensaje =
                "Se registrará la factura " +
                (oComprobante.serieDocumento || "") + "-" + (oComprobante.numeroDocumento || "") +
                " con estado \u201CENVIADO\u201D y será remitida a la bandeja de contabilización.\n\n" +
                "Periodo asociado: " + sPeriodo + "\n" +
                "Asignaciones (" + aAsignaciones.length + "):\n" + sLineas +
                "\n\nEsta acción no se puede deshacer. ¿Desea continuar?";
            MessageBox.confirm(sMensaje, {
                title: "Confirmar Registro y Envío",
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        that._guardarComprobante("ENVIADO");
                    }
                }
            });
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
                        that.onNavBack();
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
            var that = this;
            var oViewModel = this.getView().getModel("viewModel");
            if (oViewModel.getProperty("/readOnly") || oViewModel.getProperty("/registrationComplete")) {
                this.getOwnerComponent().getRouter().navTo("RouteDocumentList");
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
                            that.getOwnerComponent().getRouter().navTo("RouteDocumentList");
                        }
                    }
                }
            );
        },

        onNavBack: function () {
            var that = this;
            var oViewModel = this.getView().getModel("viewModel");
            var fnNavigate = function () {
                var oRouter = that.getOwnerComponent().getRouter();
                oRouter.navTo("RouteDocumentDetail", {
                    documentId: that._sDocumentId,
                    tipoDocumento: that._sTipoDocumento,
                    numeroDocumento: that._sNumeroDocumento
                });
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
