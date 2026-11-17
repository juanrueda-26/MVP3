import { initRouter, onViewChange } from "./router.js";
import { initProducts, renderProductsTable } from "./productos.js";
import { initSale } from "./venta.js";
import { initHistory, renderHistory } from "./historial.js";
import { initInvoice } from "./invoice.js";
import { initCategorias, renderCategoriasTable } from './categorias.js';
import { initClientes, renderClientesTable } from "./clientes.js";
import { initProveedores, renderProveedoresTable } from "./proveedores.js";
import { initCompras, renderComprasTable } from "./compras.js";

initInvoice();
initProducts(() => {});
initSale();
initHistory();
initCategorias(); // Inicializa los eventos del modal y botones una sola vez
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
  if (view === "compras") renderComprasTable();
});
window.addEventListener("sale:completed", () => {
  renderHistory();
  renderProductsTable();
});

document.addEventListener('DOMContentLoaded', () => {
  const loginModal = document.getElementById('loginModalBackdrop');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginFormError');

  // Si ya hay una sesión guardada, ocultamos el modal
  const currentUser = localStorage.getItem('pos_user');
  if (currentUser) {
    loginModal.hidden = true;
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    loginError.hidden = true;

    // Validación básica local para la demo (o puedes conectarlo a tu endpoint de token DRF)
    if ((username === 'asus' && password === 'asus123.') || (username === 'cajero1' && password === 'password123')) {
      localStorage.setItem('pos_user', username);
      localStorage.setItem('pos_role', username === 'asus' ? 'admin' : 'cajero');
      loginModal.hidden = true;
      
      // Si es cajero, bloqueamos visualmente los botones de modificar productos/categorías
      aplicarRestriccionesRol();
    } else {
      loginError.textContent = 'Usuario o contraseña incorrectos.';
      loginError.hidden = false;
    }
  });
});

function aplicarRestriccionesRol() {
  const usuarioActual = localStorage.getItem("usuarioActual"); // O el objeto de sesión que utilices
  
  // Seleccionamos los botones de las pestañas administrativas en el DOM
  const tabProductos = document.querySelector('[data-view="productos"]');
  const tabCategorias = document.querySelector('[data-view="categorias"]');
  const tabProveedores = document.querySelector('[data-view="proveedores"]');
  const tabCompras = document.querySelector('[data-view="compras"]');

  // Si el usuario es cajero, ocultamos o deshabilitamos las pestañas
  if (usuarioActual === "cajero1") {
    if (tabProductos) tabProductos.style.display = "none";
    if (tabCategorias) tabCategorias.style.display = "none";
    if (tabProveedores) tabProveedores.style.display = "none";
    if (tabCompras) tabCompras.style.display = "none";
  } else {
    // Si es administrador (ej. asus), nos aseguramos de que sean visibles
    if (tabProductos) tabProductos.style.display = "inline-block";
    if (tabCategorias) tabCategorias.style.display = "inline-block";
    if (tabProveedores) tabProveedores.style.display = "inline-block";
    if (tabCompras) tabCompras.style.display = "inline-block";
  }
}

if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const user = document.getElementById("loginUsername").value.trim();
    const pass = document.getElementById("loginPassword").value.trim();
    const errorEl = document.getElementById("loginFormError");

    // Validamos credenciales según los roles establecidos en la rúbrica
    if ((user === "asus" && pass === "asus") || (user === "cajero1" && pass === "cajero1")) {
      
      // 1. Guardamos la sesión activa en el localStorage
      localStorage.setItem("usuarioActual", user);
      
      // 2. Ocultamos el modal de login
      const modalLogin = document.getElementById("loginModalBackdrop");
      if (modalLogin) modalLogin.hidden = true;

      // 3. Aplicamos las restricciones visuales de roles inmediatamente
      aplicarRestriccionesRol();

    } else {
      if (errorEl) {
        errorEl.textContent = "Usuario o contraseña incorrectos.";
        errorEl.hidden = false;
      }
    }
  });
}

// Función que aplica el control de acceso del Momento 1
function aplicarRestriccionesRol() {
  const usuarioActual = localStorage.getItem("usuarioActual");
  
  // Seleccionamos los botones de las pestañas exclusivas de administración
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

// Ejecutar al cargar la página por si ya había una sesión iniciada
document.addEventListener("DOMContentLoaded", () => {
  const usuarioActual = localStorage.getItem("usuarioActual");
  const modalLogin = document.getElementById("loginModalBackdrop");
  
  if (usuarioActual) {
    if (modalLogin) modalLogin.hidden = true;
    aplicarRestriccionesRol();
  }
});
