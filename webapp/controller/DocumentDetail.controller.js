sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/Device",
    "claro/com/clarocomprobantes/service/MockDataService",
    "claro/com/clarocomprobantes/model/formatter"
], function (Controller, JSONModel, MessageBox, MessageToast, Device, MockDataService, formatter) {
    "use strict";

    return Controller.extend("claro.com.clarocomprobantes.controller.DocumentDetail", {
        
        formatter: formatter,
        
        onInit: function () {
            this._oMockDataService = new MockDataService();
            this._allPosiciones = [];
            this._allComprobantes = [];
            
            var oViewModel = new JSONModel({
                comprobantesCount: 0,
                selectedTab: "general",
                isPhone: window.innerWidth < 600,
                // Pagination — posiciones
                posicionesPage: 1,
                posicionesTotal: 0,
                posicionesPageCount: 0,
                posicionesPageInfo: "",
                posicionesPrevEnabled: false,
                posicionesNextEnabled: false,
                posicionesFirstEnabled: false,
                posicionesLastEnabled: false,
                // Pagination — comprobantes
                comprobantesPage: 1,
                comprobantesTotal: 0,
                comprobantesPageCount: 0,
                comprobantesPageInfo: "",
                comprobantesPrevEnabled: false,
                comprobantesNextEnabled: false,
                comprobantesFirstEnabled: false,
                comprobantesLastEnabled: false
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

            // Modelo del detalle del documento
            var oDetalleModel = new JSONModel({});
            this.getView().setModel(oDetalleModel, "detalle");
            
            // Modelo del contrato (para tipo CONTRATO)
            var oContratoModel = new JSONModel({});
            this.getView().setModel(oContratoModel, "contrato");
            
            // Modelo de posiciones (para OC y Póliza)
            var oPosicionesModel = new JSONModel([]);
            this.getView().setModel(oPosicionesModel, "posiciones");
            
            // Modelo de comprobantes registrados
            var oComprobantesModel = new JSONModel([]);
            this.getView().setModel(oComprobantesModel, "comprobantes");
            
            // Router
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteDocumentDetail").attachPatternMatched(this._onRouteMatched, this);
        },
        
        _onRouteMatched: function (oEvent) {
            var oArgs = oEvent.getParameter("arguments");
            this._sDocumentId = oArgs.documentId;
            this._sTipoDocumento = oArgs.tipoDocumento;
            this._sNumeroDocumento = oArgs.numeroDocumento;
            
            // Cargar datos
            this._loadData();
        },
        
        _loadData: function () {
            var that = this;
            
            this._oMockDataService.loadAllData().then(function () {
                that._loadDocumentDetail();
            }).catch(function (oError) {
                MessageBox.error("Error al cargar los datos: " + oError.message);
            });
        },
        
        _loadDocumentDetail: function () {
            // Obtener el documento
            var oDocumento = this._oMockDataService.getDocumentoById(this._sDocumentId);
            
            if (!oDocumento) {
                MessageBox.error("Documento no encontrado");
                this.onNavBack();
                return;
            }
            
            // Actualizar modelo de detalle
            this.getView().getModel("detalle").setData(oDocumento);
            
            // Cargar datos específicos según tipo de documento
            if (oDocumento.tipoDocumento === "CONTRATO") {
                this._loadContratoDetail(oDocumento.numeroDocumento);
            } else if (oDocumento.tipoDocumento === "OC") {
                this._loadOrdenCompraDetail(oDocumento.numeroDocumento);
            } else if (oDocumento.tipoDocumento === "POLIZA" || oDocumento.tipoDocumento === "Póliza") {
                this._loadPolizaDetail(oDocumento.numeroDocumento);
            }
            
            // Cargar comprobantes asociados al documento
            this._loadComprobantes(oDocumento.numeroDocumento);
        },
        
        _loadContratoDetail: function (sNumeroContrato) {
            var oContrato = this._oMockDataService.getContratoByNumero(sNumeroContrato);
            
            if (oContrato) {
                this.getView().getModel("contrato").setData(oContrato);
            }
            // Contratos use conceptos, not posiciones
            this._allPosiciones = [];
            this._applyPosicionesPagination(1);
        },
        
        _loadOrdenCompraDetail: function (sNumeroOC) {
            var oOrdenCompra = this._oMockDataService.getOrdenCompraByNumero(sNumeroOC);
            
            if (oOrdenCompra) {
                this.getView().getModel("contrato").setData({
                    interlocutor: {
                        razonSocial: oOrdenCompra.proveedorNombre || "",
                        ruc: oOrdenCompra.proveedorRuc || ""
                    },
                    condicionesPago: oOrdenCompra.condicionesPago || "",
                    datosContables: oOrdenCompra.datosContables || { centroCoste: "", cuentaContable: "" }
                });
                this._allPosiciones = oOrdenCompra.posiciones || [];
                this._applyPosicionesPagination(1);
            }
        },
        
        _loadPolizaDetail: function (sNumeroPoliza) {
            var oPoliza = this._oMockDataService.getPolizaByNumero(sNumeroPoliza);
            
            if (oPoliza) {
                this.getView().getModel("contrato").setData({
                    interlocutor: {
                        razonSocial: oPoliza.proveedorNombre || "",
                        ruc: oPoliza.proveedorRuc || ""
                    },
                    condicionesPago: oPoliza.condicionesPago || "",
                    datosContables: oPoliza.datosContables || { centroCoste: "", cuentaContable: "" }
                });
                this._allPosiciones = oPoliza.posiciones || [];
                this._applyPosicionesPagination(1);
            }
        },
        
        _loadComprobantes: function (sNumeroDocumento) {
            var aComprobantes = this._oMockDataService.getComprobantes();
            
            // Filtrar comprobantes asociados a este documento
            this._allComprobantes = aComprobantes.filter(function (oComp) {
                return oComp.documentoOrigen && oComp.documentoOrigen.numero === sNumeroDocumento;
            });
            
            this.getView().getModel("viewModel").setProperty("/comprobantesCount", this._allComprobantes.length);
            this._applyComprobantesPagination(1);
        },

        /* ─────────────── POSICIONES PAGINATION ─────────────── */
        _applyPosicionesPagination: function (iPage) {
            var nPageSize = 20;
            var nTotal = this._allPosiciones.length;
            var nPageCount = Math.max(1, Math.ceil(nTotal / nPageSize));
            iPage = Math.max(1, Math.min(iPage, nPageCount));

            var aSlice = this._allPosiciones.slice((iPage - 1) * nPageSize, iPage * nPageSize);
            this.getView().getModel("posiciones").setData(aSlice);

            var oVM = this.getView().getModel("viewModel");
            oVM.setProperty("/posicionesPage", iPage);
            oVM.setProperty("/posicionesTotal", nTotal);
            oVM.setProperty("/posicionesPageCount", nPageCount);
            oVM.setProperty("/posicionesPageInfo", "Página " + iPage + " de " + nPageCount + " | " + nTotal + " registros");
            oVM.setProperty("/posicionesPrevEnabled", iPage > 1);
            oVM.setProperty("/posicionesNextEnabled", iPage < nPageCount);
            oVM.setProperty("/posicionesFirstEnabled", iPage > 1);
            oVM.setProperty("/posicionesLastEnabled", iPage < nPageCount);
        },

        onPosicionesFirstPage: function () { this._applyPosicionesPagination(1); },
        onPosicionesPrevPage: function () { this._applyPosicionesPagination(this.getView().getModel("viewModel").getProperty("/posicionesPage") - 1); },
        onPosicionesNextPage: function () { this._applyPosicionesPagination(this.getView().getModel("viewModel").getProperty("/posicionesPage") + 1); },
        onPosicionesLastPage: function () { this._applyPosicionesPagination(this.getView().getModel("viewModel").getProperty("/posicionesPageCount")); },

        /* ─────────────── COMPROBANTES PAGINATION ─────────────── */
        _applyComprobantesPagination: function (iPage) {
            var nPageSize = 20;
            var nTotal = this._allComprobantes.length;
            var nPageCount = Math.max(1, Math.ceil(nTotal / nPageSize));
            iPage = Math.max(1, Math.min(iPage, nPageCount));

            var aSlice = this._allComprobantes.slice((iPage - 1) * nPageSize, iPage * nPageSize);
            this.getView().getModel("comprobantes").setData(aSlice);

            var oVM = this.getView().getModel("viewModel");
            oVM.setProperty("/comprobantesPage", iPage);
            oVM.setProperty("/comprobantesTotal", nTotal);
            oVM.setProperty("/comprobantesPageCount", nPageCount);
            oVM.setProperty("/comprobantesPageInfo", "Página " + iPage + " de " + nPageCount + " | " + nTotal + " registros");
            oVM.setProperty("/comprobantesPrevEnabled", iPage > 1);
            oVM.setProperty("/comprobantesNextEnabled", iPage < nPageCount);
            oVM.setProperty("/comprobantesFirstEnabled", iPage > 1);
            oVM.setProperty("/comprobantesLastEnabled", iPage < nPageCount);
        },

        onComprobantesFirstPage: function () { this._applyComprobantesPagination(1); },
        onComprobantesPrevPage: function () { this._applyComprobantesPagination(this.getView().getModel("viewModel").getProperty("/comprobantesPage") - 1); },
        onComprobantesNextPage: function () { this._applyComprobantesPagination(this.getView().getModel("viewModel").getProperty("/comprobantesPage") + 1); },
        onComprobantesLastPage: function () { this._applyComprobantesPagination(this.getView().getModel("viewModel").getProperty("/comprobantesPageCount")); },
        
        onTabSelect: function (oEvent) {
            var sKey = oEvent.getParameter("key");
            this.getView().getModel("viewModel").setProperty("/selectedTab", sKey);
        },
        
        onRegisterVoucher: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteRegisterVoucher", {
                documentId: this._sDocumentId,
                tipoDocumento: this._sTipoDocumento,
                numeroDocumento: this._sNumeroDocumento
            });
        },
        
        onComprobanteSelect: function (oEvent) {
            // Selección de comprobante
        },
        
        onViewComprobante: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("comprobantes");
            var oComprobante = oContext.getObject();
            
            this.getOwnerComponent().getRouter().navTo("RouteVoucherDetail", {
                documentId: this._sDocumentId,
                tipoDocumento: this._sTipoDocumento,
                numeroDocumento: this._sNumeroDocumento,
                comprobanteId: oComprobante.id,
                mode: "view"
            });
        },
        
        onEditComprobante: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("comprobantes");
            var oComprobante = oContext.getObject();
            
            if (oComprobante.estado !== "REGISTRADO") {
                MessageBox.warning("Solo se pueden editar comprobantes en estado REGISTRADO");
                return;
            }
            
            this.getOwnerComponent().getRouter().navTo("RouteVoucherDetail", {
                documentId: this._sDocumentId,
                tipoDocumento: this._sTipoDocumento,
                numeroDocumento: this._sNumeroDocumento,
                comprobanteId: oComprobante.id,
                mode: "edit"
            });
        },
        
        onDeleteComprobante: function (oEvent) {
            var oItem = oEvent.getSource().getBindingContext("comprobantes").getObject();
            var that = this;
            MessageBox.confirm(
                "¿Está seguro de eliminar el comprobante " + oItem.serieDocumento + "-" + oItem.numeroDocumento + "?\nEsta acción no se puede deshacer.",
                {
                    title: "Confirmar Eliminación",
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.CANCEL,
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            var aAll = that._oMockDataService.getComprobantes();
                            var iIdx = aAll.findIndex(function (o) { return o.id === oItem.id; });
                            if (iIdx >= 0) {
                                aAll.splice(iIdx, 1);
                            }
                            that._loadComprobantes(that._sNumeroDocumento);
                            MessageToast.show("Comprobante eliminado correctamente.");
                        }
                    }
                }
            );
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteDocumentList");
        },
        
        /**
         * Obtiene el servicio de datos mock
         * @returns {MockDataService} Servicio de datos
         */
        getMockDataService: function () {
            return this._oMockDataService;
        },

        onExit: function () {
            if (this._fnResizeHandler) {
                window.removeEventListener("resize", this._fnResizeHandler);
            }
        }
    });
});
