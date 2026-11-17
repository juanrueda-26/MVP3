// sale.js — flujo completo de "Nueva venta": buscar, agregar, cobrar, confirmar

import { getProducts, updateProducto, getSales, createSale, updateSale } from "./storage.js";
import { apiPost } from "./api.js";
import { formatCOP, isNonNegativeNumber, showToast } from "./utils.js";
import { showView } from "./router.js";
import { renderTicket } from "./invoice.js";

let cart = []; // [{ productId, nombre, precioUnitario, cantidad, stockDisponible }]

const searchInput = document.getElementById("productSearch");
const resultsList = document.getElementById("searchResults");
const cartBody = document.getElementById("cartBody");
const cartEmpty = document.getElementById("cartEmpty");

const sumSubtotal = document.getElementById("sumSubtotal");
const sumTotal = document.getElementById("sumTotal");
const sumChange = document.getElementById("sumChange");
const cashFields = document.getElementById("cashFields");
const cashReceived = document.getElementById("cashReceived");
const saleError = document.getElementById("saleError");

export function initSale() {
  if (searchInput) {
    searchInput.addEventListener("input", renderSearchResults);
    searchInput.addEventListener("focus", renderSearchResults);
  }
  document.addEventListener("click", (e) => {
    if (resultsList && !resultsList.contains(e.target) && e.target !== searchInput) {
      resultsList.hidden = true;
    }
  });

  document.querySelectorAll('input[name="metodoPago"]').forEach((radio) => {
    radio.addEventListener("change", syncCashFields);
  });
  if (cashReceived) cashReceived.addEventListener("input", updateTotals);

  const btnClear = document.getElementById("btnClearSale");
  if (btnClear) btnClear.addEventListener("click", clearSale);

  const btnConfirm = document.getElementById("btnConfirmSale");
  if (btnConfirm) btnConfirm.addEventListener("click", (e) => confirmSale(e));

  syncCashFields();
  renderCart();
}

// ---------- Función de escape HTML (Soluciona el error actual) ----------
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}

// ---------- Búsqueda de productos ----------

async function renderSearchResults() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    resultsList.hidden = true;
    resultsList.innerHTML = "";
    return;
  }

  let productsList = getProducts();
  if (productsList instanceof Promise) {
    productsList = await productsList;
  }
  const productsArray = Array.isArray(productsList) ? productsList : [];

  const matches = productsArray
    .filter((p) => [p.nombre, p.codigoInterno].join(" ").toLowerCase().includes(query))
    .slice(0, 8);

  resultsList.innerHTML = "";

  if (matches.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="sr-meta">Sin resultados para "${escapeHTML(searchInput.value)}"</span>`;
    resultsList.appendChild(li);
  } else {
    matches.forEach((p) => {
      const li = document.createElement("li");
      const stockLabel = p.seguimientoInventario ? `· stock: ${p.stock ?? 0}` : "";
      li.innerHTML = `
        <div>
          <span class="sr-name">${escapeHTML(p.nombre)}</span><br>
          <span class="sr-meta">${escapeHTML(p.codigoInterno)} ${stockLabel}</span>
        </div>
        <div style="display:flex; align-items:center; gap:.75rem;">
          <span class="sr-price">${formatCOP(p.precioVenta)}</span>
          <button class="btn btn--primary" type="button" style="padding:.4rem .8rem; font-size:.78rem;">Agregar</button>
        </div>
      `;
      li.querySelector("button").addEventListener("click", () => addToCart(p));
      resultsList.appendChild(li);
    });
  }

  resultsList.hidden = false;
}

// ---------- Carrito ----------

function addToCart(product) {
  const existing = cart.find((item) => item.productId === product.id);
  const currentQty = existing ? existing.cantidad : 0;

  if (product.seguimientoInventario && currentQty + 1 > (product.stock ?? 0)) {
    showToast(`Sin stock suficiente de "${product.nombre}".`);
    return;
  }

  if (existing) {
    existing.cantidad += 1;
  } else {
    cart.push({
      productId: product.id,
      nombre: product.nombre,
      precioUnitario: product.precioVenta,
      cantidad: 1,
      stockDisponible: product.seguimientoInventario ? product.stock : null,
    });
  }

  searchInput.value = "";
  resultsList.hidden = true;
  renderCart();
}

function changeQty(productId, delta) {
  const item = cart.find((i) => i.productId === productId);
  if (!item) return;

  const newQty = item.cantidad + delta;
  if (newQty < 1) {
    removeFromCart(productId);
    return;
  }
  if (item.stockDisponible !== null && newQty > item.stockDisponible) {
    showToast("No hay stock suficiente para esa cantidad.");
    return;
  }
  item.cantidad = newQty;
  renderCart();
}

function setQty(productId, value) {
  const item = cart.find((i) => i.productId === productId);
  if (!item) return;

  let qty = parseInt(value, 10);
  if (Number.isNaN(qty) || qty < 1) qty = 1;
  if (item.stockDisponible !== null && qty > item.stockDisponible) {
    qty = item.stockDisponible;
    showToast("Cantidad ajustada al stock disponible.");
  }
  item.cantidad = qty;
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter((i) => i.productId !== productId);
  renderCart();
}

function clearSale() {
  if (cart.length > 0 && !window.confirm("¿Vaciar todos los productos de esta venta?")) return;
  cart = [];
  cashReceived.value = "";
  saleError.hidden = true;
  renderCart();
}

function renderCart() {
  cartBody.innerHTML = "";

  cart.forEach((item) => {
    const subtotal = item.precioUnitario * item.cantidad;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(item.nombre)}</td>
      <td>${formatCOP(item.precioUnitario)}</td>
      <td>
        <span class="qty-control">
          <button type="button" data-action="dec" aria-label="Restar">−</button>
          <input type="number" min="1" value="${item.cantidad}" aria-label="Cantidad">
          <button type="button" data-action="inc" aria-label="Sumar">+</button>
        </span>
      </td>
      <td>${formatCOP(subtotal)}</td>
      <td><button class="icon-btn" title="Quitar" aria-label="Quitar producto">✕</button></td>
    `;
    tr.querySelector('[data-action="dec"]').addEventListener("click", () => changeQty(item.productId, -1));
    tr.querySelector('[data-action="inc"]').addEventListener("click", () => changeQty(item.productId, 1));
    tr.querySelector('input[type="number"]').addEventListener("change", (e) => setQty(item.productId, e.target.value));
    tr.querySelector(".icon-btn").addEventListener("click", () => removeFromCart(item.productId));
    cartBody.appendChild(tr);
  });

  cartEmpty.hidden = cart.length > 0;
  updateTotals();
}

// ---------- Totales y pago ----------

function getTotal() {
  return cart.reduce((sum, item) => sum + item.precioUnitario * item.cantidad, 0);
}

function getSelectedMethod() {
  const checked = document.querySelector('input[name="metodoPago"]:checked');
  return checked ? checked.value : "Efectivo";
}

function syncCashFields() {
  const isCash = getSelectedMethod() === "Efectivo";
  cashFields.classList.toggle("is-visible", isCash);
  updateTotals();
}

function updateTotals() {
  const total = getTotal();
  sumSubtotal.textContent = formatCOP(total);
  sumTotal.textContent = formatCOP(total);

  if (getSelectedMethod() === "Efectivo") {
    const received = Number(cashReceived.value) || 0;
    const change = received - total;
    sumChange.textContent = formatCOP(change > 0 ? change : 0);
  } else {
    sumChange.textContent = formatCOP(0);
  }
}

// ---------- Confirmar venta conectada a la API de Django ----------

async function confirmSale(e) {
  if (e) e.preventDefault();
  saleError.hidden = true;

  if (cart.length === 0) {
    return showSaleError("Agrega al menos un producto antes de confirmar la venta.");
  }

  const metodoPago = getSelectedMethod();
  const total = getTotal();
  let valorRecibido = null;
  let cambio = 0;

  if (metodoPago === "Efectivo") {
    if (!isNonNegativeNumber(cashReceived.value)) {
      return showSaleError("Ingresa el valor recibido en efectivo.");
    }
    valorRecibido = Number(cashReceived.value);
    if (valorRecibido < total) {
      return showSaleError("El valor recibido es menor que el total de la venta.");
    }
    cambio = valorRecibido - total;
  }

  // Obtenemos los productos actuales de la API de forma segura
  let productsList = getProducts();
  if (productsList instanceof Promise) {
    productsList = await productsList;
  }
  const products = Array.isArray(productsList) ? productsList : [];

  // Validar stock disponible antes de proceder
  for (const item of cart) {
    const product = products.find((p) => p.id === item.productId);
    if (product && product.seguimientoInventario) {
      if ((product.stock ?? 0) < item.cantidad) {
        return showSaleError(`Stock insuficiente de "${product.nombre}".`);
      }
    }
  }

  // 1. Descontar stock y actualizar cada producto en el servidor de Django
  for (const item of cart) {
    const product = products.find((p) => p.id === item.productId);
    if (product && product.seguimientoInventario) {
      product.stock = (product.stock ?? 0) - item.cantidad;
      
      try {
        await fetch(`http://127.0.0.1:8000/api/productos/${product.id}/`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: product.nombre,
            precio: product.precioVenta,
            costo: product.costo || 0,
            stock: product.stock,
            categoria: Number(product.categoria) || 1,
            proveedor: 1
          })
        });
      } catch (err) {
        console.error("Error actualizando stock en el servidor:", err);
      }
    }
  }

  // 2. Preparamos el payload que espera el VentaSerializer de tu backend
  const ventaPayload = {
    total: total,
    metodo_pago: metodoPago,
    valor_recibido: valorRecibido,
    cambio: cambio,
    estado: "cerrada",
    cliente: 1, // ID por defecto o seleccionado
    usuario: 1, // ID del usuario activo
    items: cart.map((i) => ({
      producto: i.productId,
      cantidad: i.cantidad,
      precio_unitario: i.precioUnitario
    }))
  };

  try {
    // Registramos la venta en la base de datos de Django
    await apiPost("ventas", ventaPayload);
  } catch (err) {
    console.error("Error al registrar la venta en Django:", err);
    return showSaleError("No se pudo registrar la venta en el servidor.");
  }

  showToast(`Venta confirmada exitosamente.`);

  const sale = {
    id: "venta-" + Date.now(),
    numero: Math.floor(1000 + Math.random() * 9000),
    fecha: new Date().toISOString(),
    items: cart.map((i) => ({
      productId: i.productId,
      nombre: i.nombre,
      precioUnitario: i.precioUnitario,
      cantidad: i.cantidad,
      subtotal: i.precioUnitario * i.cantidad,
    })),
    total,
    metodoPago,
    valorRecibido,
    cambio,
    estado: "cerrada",
  };

  // Reset del formulario de venta
  cart = [];
  cashReceived.value = "";
  renderCart();

  // Ir a la vista de factura y notificar completado
  renderTicket(sale, { showConfirmBanner: true });
  showView("factura");

  window.dispatchEvent(new CustomEvent("sale:completed"));
}