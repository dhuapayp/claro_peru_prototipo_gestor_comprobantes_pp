sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "claro/com/clarocomprobantes/service/MockDataService",
    "claro/com/clarocomprobantes/model/formatter"
], function (Controller, JSONModel, MessageBox, MessageToast, MockDataService, formatter) {
    "use strict";

    return Controller.extend("claro.com.clarocomprobantes.controller.VoucherList", {
        
        formatter: formatter,
        
        onInit: function () {
            // Inicializar servicio de datos mock
            this._oMockDataService = new MockDataService();
            
            // Modelo de vista
            var oViewModel = new JSONModel({
                filters: {
                    estado: "",
                    serieNumero: "",
                    fechaDesde: "",
                    fechaHasta: ""
                },
                voucherCount: 0,
                selectedVoucher: null
            });
            this.getView().setModel(oViewModel, "viewModel");
            
            // Modelo de comprobantes
            var oComprobantesModel = new JSONModel([]);
            this.getView().setModel(oComprobantesModel, "comprobantes");
            
            // Router
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteVoucherList").attachPatternMatched(this._onRouteMatched, this);
        },
        
        _onRouteMatched: function () {
            this._loadData();
        },
        
        _loadData: function () {
            var that = this;
            
            this._oMockDataService.loadAllData().then(function () {
                that._loadVouchers();
            }).catch(function (oError) {
                MessageBox.error("Error al cargar los datos: " + oError.message);
            });
        },
        
        _loadVouchers: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var oFilters = oViewModel.getProperty("/filters");
            
            var aComprobantes = this._oMockDataService.getComprobantes({
                estado: oFilters.estado || null
            });
            
            // Aplicar filtros adicionales
            if (oFilters.serieNumero) {
                var sFilter = oFilters.serieNumero.toUpperCase();
                aComprobantes = aComprobantes.filter(function (oComp) {
                    var sSerieNum = (oComp.serieDocumento + "-" + oComp.numeroDocumento).toUpperCase();
                    return sSerieNum.includes(sFilter);
                });
            }
            
            if (oFilters.fechaDesde) {
                var dDesde = new Date(oFilters.fechaDesde);
                aComprobantes = aComprobantes.filter(function (oComp) {
                    return new Date(oComp.fechaEmision) >= dDesde;
                });
            }
            
            if (oFilters.fechaHasta) {
                var dHasta = new Date(oFilters.fechaHasta);
                aComprobantes = aComprobantes.filter(function (oComp) {
                    return new Date(oComp.fechaEmision) <= dHasta;
                });
            }
            
            this.getView().getModel("comprobantes").setData(aComprobantes);
            oViewModel.setProperty("/voucherCount", aComprobantes.length);
        },
        
        onFilterChange: function () {
            if (this._filterTimeout) {
                clearTimeout(this._filterTimeout);
            }
            
            var that = this;
            this._filterTimeout = setTimeout(function () {
                that._loadVouchers();
            }, 300);
        },
        
        onClearFilters: function () {
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/filters", {
                estado: "",
                serieNumero: "",
                fechaDesde: "",
                fechaHasta: ""
            });
            this._loadVouchers();
        },
        
        onRefresh: function () {
            MessageToast.show("Actualizando...");
            this._loadData();
        },
        
        onVoucherSelect: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            var oContext = oSelectedItem.getBindingContext("comprobantes");
            var oVoucher = oContext.getObject();
            
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/selectedVoucher", oVoucher);
        },
        
        onVoucherPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("comprobantes");
            var oVoucher = oContext.getObject();
            this._navigateToVoucherDetail(oVoucher);
        },
        
        _navigateToVoucherDetail: function (oVoucher) {
            // Por ahora, solo mostrar mensaje
            MessageToast.show("Ver detalle: " + oVoucher.serieDocumento + "-" + oVoucher.numeroDocumento);
        },
        
        onViewVoucher: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("comprobantes");
            var oVoucher = oContext.getObject();
            this._navigateToVoucherDetail(oVoucher);
        },
        
        onEditVoucher: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("comprobantes");
            var oVoucher = oContext.getObject();
            
            if (oVoucher.estado !== "REGISTRADO") {
                MessageBox.warning("Solo se pueden editar comprobantes en estado REGISTRADO");
                return;
            }
            
            MessageToast.show("Editar: " + oVoucher.serieDocumento + "-" + oVoucher.numeroDocumento);
        },
        
        onSendVoucher: function (oEvent) {
            var that = this;
            var oContext = oEvent.getSource().getBindingContext("comprobantes");
            var oVoucher = oContext.getObject();
            
            if (oVoucher.estado !== "REGISTRADO") {
                MessageBox.warning("Solo se pueden enviar comprobantes en estado REGISTRADO");
                return;
            }
            
            MessageBox.confirm("¿Está seguro de enviar el comprobante " + oVoucher.serieDocumento + "-" + oVoucher.numeroDocumento + "?", {
                title: "Confirmar envío",
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        // Simular envío
                        oVoucher.estado = "ENVIADO";
                        oVoucher.estadoDesc = "Enviado";
                        oVoucher.fechaModificacion = new Date().toISOString();
                        
                        that._oMockDataService.saveComprobante(oVoucher);
                        that._loadVouchers();
                        
                        MessageToast.show("Comprobante enviado exitosamente");
                    }
                }
            });
        },
        
        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteDocumentList");
        }
    });
});
