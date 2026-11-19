import { initRouter, onViewChange } from "./router.js";
import { initProducts, renderProductsTable } from "./productos.js";
import { initSale } from "./venta.js";
import { initHistory, renderHistory } from "./historial.js";
import { initInvoice } from "./invoice.js";
import { initCategorias, renderCategoriasTable } from './categorias.js';
import { initClientes, renderClientesTable } from "./clientes.js";
import { initProveedores, renderProveedoresTable } from "./proveedores.js";
import { initCompras, renderComprasTable,renderFaltantesTable } from "./compras.js";

initInvoice();
initProducts(() => {});
initSale();
initHistory();
initCategorias();
initRouter();
initClientes();
initProveedores();
initCompras();

onViewChange((view) => {
  if (view === "historial") renderHistory();
  if (view === "productos") renderProductsTable();
  if (view === "categorias") renderCategoriasTable();
  if (view === "clientes") renderClientesTable();
  if (view === "proveedores") renderProveedoresTable();
  if (view === "compras"){ 
    renderComprasTable(); 
    renderFaltantesTable(); }

});

window.addEventListener("sale:completed", () => {
  renderHistory();
  renderProductsTable();
});

// Función centralizada para aplicar el control de acceso por roles (Momento 1)
function aplicarRestriccionesRol() {
  const usuarioActual = localStorage.getItem("usuarioActual");
  
  // Seleccionamos las pestañas administrativas exclusivas
  const tabsAdministrativas = document.querySelectorAll(
    '[data-view="productos"], [data-view="categorias"], [data-view="proveedores"], [data-view="compras"]'
  );

  tabsAdministrativas.forEach(tab => {
    if (usuarioActual === "cajero1") {
      // Si es cajero, ocultamos las pestañas administrativas
      tab.style.display = "none";
    } else {
      // Si es administrador (asus), las mostramos con normalidad
      tab.style.display = "inline-block";
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const loginModal = document.getElementById('loginModalBackdrop');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginFormError');

  // Si ya hay una sesión guardada, ocultamos el modal y aplicamos restricciones
  const usuarioActual = localStorage.getItem('usuarioActual');
  if (usuarioActual) {
    if (loginModal) loginModal.hidden = true;
    aplicarRestriccionesRol();
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value.trim();

      if (loginError) loginError.hidden = true;

      // Validación unificada para administrador (asus) y cajero (cajero1)
      if ((username === 'asus' && password === 'asus') || (username === 'cajero1' && password === 'cajero1')) {
        localStorage.setItem('usuarioActual', username);
        
        if (loginModal) loginModal.hidden = true;
        
        // Aplicamos el bloqueo visual de pestañas inmediatamente
        aplicarRestriccionesRol();
        
      } else {
        if (loginError) {
          loginError.textContent = 'Usuario o contraseña incorrectos.';
          loginError.hidden = false;
        }
      }
    });
  }
});


