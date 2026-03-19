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

    var PAGE_SIZE = 20;

    return Controller.extend("claro.com.clarocomprobantes.controller.DocumentList", {

        formatter: formatter,
        _allFilteredDocumentos: [],

        onInit: function () {
            this._oMockDataService = new MockDataService();

            var oViewModel = new JSONModel({
                filters: { tipoDocumento: "", numeroDocumento: "", fechaDesde: "", fechaHasta: "" },
                documentCount: 0,
                totalMontoPEN: 0,
                totalMontoUSD: 0,
                selectedRol: "proveedor",
                isPhone: window.innerWidth < 600,
                currentPage: 1,
                totalPages: 1,
                prevEnabled: false,
                nextEnabled: false,
                firstEnabled: false,
                lastEnabled: false,
                pageInfo: "1 - 0 · 0 registros"
            });
            this.getView().setModel(oViewModel, "viewModel");
            this.getView().setModel(new JSONModel([]), "documentos");
            this.getView().setModel(new JSONModel({}), "usuario");

            // Listener nativo resize: reactivo en Chrome DevTools y dispositivos reales
            var that0 = this;
            this._fnResizeHandler = function () {
                var bPhone = window.innerWidth < 600;
                var oVM = that0.getView() && that0.getView().getModel("viewModel");
                if (oVM) { oVM.setProperty("/isPhone", bPhone); }
            };
            window.addEventListener("resize", this._fnResizeHandler);

            this._loadData();

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteDocumentList").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            this._loadDocuments();
        },

        _loadData: function () {
            var that = this;
            this._oMockDataService.loadAllData().then(function () {
                var oUsuario = that._oMockDataService.getUsuarioActual();
                var oConfig = that._oMockDataService.getConfiguracion();
                that.getView().getModel("usuario").setData({ usuario: oUsuario, configuracion: oConfig });
                that._loadDocuments();
            }).catch(function (oError) {
                MessageBox.error("Error al cargar los datos: " + oError.message);
            });
        },

        _loadDocuments: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var oFilters = oViewModel.getProperty("/filters");

            var aAll = this._oMockDataService.getDocumentos({
                tipoDocumento: oFilters.tipoDocumento || null,
                numeroDocumento: oFilters.numeroDocumento || null,
                fechaDesde: oFilters.fechaDesde ? new Date(oFilters.fechaDesde) : null,
                fechaHasta: (function () {
                    if (!oFilters.fechaHasta) { return null; }
                    var d = new Date(oFilters.fechaHasta);
                    d.setHours(23, 59, 59, 999);
                    return d;
                })()
            });

            this._allFilteredDocumentos = aAll;

            // KPIs
            var nPEN = 0, nUSD = 0;
            aAll.forEach(function (d) {
                if (d.moneda === "PEN") { nPEN += d.valorDocumento || 0; }
                else if (d.moneda === "USD") { nUSD += d.valorDocumento || 0; }
            });
            oViewModel.setProperty("/documentCount", aAll.length);
            oViewModel.setProperty("/totalMontoPEN", nPEN);
            oViewModel.setProperty("/totalMontoUSD", nUSD);
            oViewModel.setProperty("/currentPage", 1);

            this._applyPagination();
        },

        _applyPagination: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var nCurrent = oViewModel.getProperty("/currentPage");
            var nTotal = this._allFilteredDocumentos.length;
            var nTotalPages = Math.max(1, Math.ceil(nTotal / PAGE_SIZE));
            var aPage = this._allFilteredDocumentos.slice((nCurrent - 1) * PAGE_SIZE, nCurrent * PAGE_SIZE);

            this.getView().getModel("documentos").setData(aPage);
            oViewModel.setProperty("/totalPages", nTotalPages);
            oViewModel.setProperty("/prevEnabled", nCurrent > 1);
            oViewModel.setProperty("/nextEnabled", nCurrent < nTotalPages);
            oViewModel.setProperty("/firstEnabled", nCurrent > 1);
            oViewModel.setProperty("/lastEnabled", nCurrent < nTotalPages);
            oViewModel.setProperty("/pageInfo", "Página " + nCurrent + " de " + nTotalPages + " | " + nTotal + " registros");
        },

        onFilterChange: function () { /* manual search via button */ },

        onBuscar: function () { this._loadDocuments(); },

        onClearFilters: function () {
            this.getView().getModel("viewModel").setProperty("/filters",
                { tipoDocumento: "", numeroDocumento: "", fechaDesde: "", fechaHasta: "" });
            this._loadDocuments();
        },

        onRefresh: function () {
            MessageToast.show("Actualizando...");
            this._loadData();
        },

        onPrevPage: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var n = oViewModel.getProperty("/currentPage");
            if (n > 1) { oViewModel.setProperty("/currentPage", n - 1); this._applyPagination(); }
        },

        onNextPage: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var n = oViewModel.getProperty("/currentPage");
            var t = oViewModel.getProperty("/totalPages");
            if (n < t) { oViewModel.setProperty("/currentPage", n + 1); this._applyPagination(); }
        },

        onFirstPage: function () {
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/currentPage", 1);
            this._applyPagination();
        },

        onLastPage: function () {
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/currentPage", oViewModel.getProperty("/totalPages"));
            this._applyPagination();
        },

        onDocumentPress: function (oEvent) {
            var oDoc = oEvent.getSource().getBindingContext("documentos").getObject();
            this._navigateToDetail(oDoc);
        },

        _navigateToDetail: function (oDocument) {
            this.getOwnerComponent().getRouter().navTo("RouteDocumentDetail", {
                documentId: oDocument.id,
                tipoDocumento: oDocument.tipoDocumento,
                numeroDocumento: oDocument.numeroDocumento
            });
        },

        onNavigateToVouchers: function () {
            this.getOwnerComponent().getRouter().navTo("RouteVoucherList");
        },

        onRolChange: function (oEvent) {
            var sKey = oEvent.getSource().getSelectedKey();
            MessageToast.show("Rol activo: " + (sKey === "administrador" ? "Administrador" : "Proveedor"));
        },

        getMockDataService: function () { return this._oMockDataService; },

        onExit: function () {
            if (this._fnResizeHandler) {
                window.removeEventListener("resize", this._fnResizeHandler);
            }
        }
    });
});