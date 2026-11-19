import { getProducts } from "./storage.js";
import { apiGet, apiPost } from "./api.js";
import { formatCOP, isNonNegativeNumber, showToast } from "./utils.js";
import { showView } from "./router.js";
import { renderTicket } from "./invoice.js";

const OPEN_SALES_KEY = "papel_y_luna_ventas_abiertas_v1";

let cart = []; // [{ productId, nombre, precioUnitario, cantidad, stockDisponible }]
let appliedDiscount = 0; // Monto fijo en COP ya aplicado (solo 1 descuento permitido)
let activeOpenSaleId = null;

const searchInput = document.getElementById("productSearch");
const resultsList = document.getElementById("searchResults");
const cartBody = document.getElementById("cartBody");
const cartEmpty = document.getElementById("cartEmpty");

const sumSubtotal = document.getElementById("sumSubtotal");
const sumDiscount = document.getElementById("sumDiscount");
const discountRow = document.getElementById("discountRow");
const sumTotal = document.getElementById("sumTotal");
const sumChange = document.getElementById("sumChange");
const cashFields = document.getElementById("cashFields");
const cashReceived = document.getElementById("cashReceived");
const saleError = document.getElementById("saleError");
const clientSelect = document.getElementById("saleClientSelect");
const discountInput = document.getElementById("discountInput");
const discountType = document.getElementById("discountType");
const openSalesPanel = document.getElementById("openSalesPanel");
const listaVentasAbiertas = document.getElementById("listaVentasAbiertas");
const openSalesCount = document.getElementById("openSalesCount");

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

  const btnApplyDiscount = document.getElementById("btnApplyDiscount");
  if (btnApplyDiscount) btnApplyDiscount.addEventListener("click", applyDiscount);

  const btnSaveOpen = document.getElementById("btnSaveOpenSale");
  if (btnSaveOpen) btnSaveOpen.addEventListener("click", saveCurrentOpenSale);

  const btnOpenList = document.getElementById("btnOpenSalesList");
  if (btnOpenList) btnOpenList.addEventListener("click", toggleOpenSalesPanel);

  const btnClear = document.getElementById("btnClearSale");
  if (btnClear) btnClear.addEventListener("click", clearSale);

  const btnConfirm = document.getElementById("btnConfirmSale");
  if (btnConfirm) btnConfirm.addEventListener("click", (e) => confirmSale(e));

  loadClientsDropdown();
  updateOpenSalesBadge();
  syncCashFields();
  renderCart();
}

async function loadClientsDropdown() {
  if (!clientSelect) return;
  try {
    const clients = await apiGet("clientes");
    if (!Array.isArray(clients)) return;
    const currentVal = clientSelect.value;
    clientSelect.innerHTML = `<option value="">— Seleccionar cliente —</option>`;
    clients.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.nombre || `Cliente #${c.id}`;
      clientSelect.appendChild(opt);
    });
    if (currentVal) clientSelect.value = currentVal;
  } catch (err) {
    console.warn("No se pudieron cargar clientes:", err);
  }
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}

// ---------- Búsqueda de productos (Opción B: rechazo indicando producto) ----------

async function renderSearchResults() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    resultsList.hidden = true;
    resultsList.innerHTML = "";
    return;
  }

  let productsList = getProducts();
  if (productsList instanceof Promise) productsList = await productsList;
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

function addToCart(product) {
  if (saleError) saleError.hidden = true;
  const existing = cart.find((item) => item.productId === product.id);
  const currentQty = existing ? existing.cantidad : 0;
  const maxStock = product.stock ?? 0;

  if (product.seguimientoInventario && currentQty + 1 > maxStock) {
    const msg = `No se puede agregar más de "${product.nombre}": stock disponible ${maxStock}.`;
    showToast(msg);
    showSaleError(msg);
    return;
  }

  if (existing) {
    existing.cantidad += 1;
  } else {
    cart.push({
      productId: product.id,
      nombre: product.nombre,
      precioUnitario: Number(product.precioVenta) || 0,
      cantidad: 1,
      stockDisponible: product.seguimientoInventario ? maxStock : null,
    });
  }

  searchInput.value = "";
  resultsList.hidden = true;
  renderCart();
}

// ---------- Carrito: cantidad, precio unitario (Opción C) y quitar ----------

function changeQty(productId, delta) {
  const item = cart.find((i) => i.productId === productId);
  if (!item) return;

  const newQty = item.cantidad + delta;
  if (newQty < 1) {
    removeFromCart(productId);
    return;
  }
  if (item.stockDisponible !== null && newQty > item.stockDisponible) {
    const msg = `Stock insuficiente para "${item.nombre}" (máximo ${item.stockDisponible}).`;
    showToast(msg);
    showSaleError(msg);
    return;
  }
  if (saleError) saleError.hidden = true;
  item.cantidad = newQty;
  renderCart();
}

function setQty(productId, value) {
  const item = cart.find((i) => i.productId === productId);
  if (!item) return;

  let qty = parseInt(value, 10);
  if (Number.isNaN(qty) || qty < 1) qty = 1;
  if (item.stockDisponible !== null && qty > item.stockDisponible) {
    const msg = `Stock insuficiente para "${item.nombre}": se ajustó al máximo disponible (${item.stockDisponible}).`;
    qty = item.stockDisponible;
    showToast(msg);
    showSaleError(msg);
  }
  item.cantidad = qty;
  renderCart();
}

function setUnitPrice(productId, value) {
  const item = cart.find((i) => i.productId === productId);
  if (!item) return;

  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    showSaleError(`El precio de "${item.nombre}" no puede ser negativo.`);
    renderCart();
    return;
  }
  if (saleError) saleError.hidden = true;
  item.precioUnitario = parsed;
  renderCart();
}

function removeFromCart(productId) {
  cart = cart.filter((i) => i.productId !== productId);
  renderCart();
}

function clearSale() {
  if (cart.length > 0 && !window.confirm("¿Vaciar todos los productos de esta venta?")) return;
  resetSaleState();
}

function resetSaleState() {
  cart = [];
  appliedDiscount = 0;
  activeOpenSaleId = null;
  if (discountInput) {
    discountInput.value = "";
    discountInput.disabled = false;
  }
  if (document.getElementById("btnApplyDiscount")) {
    document.getElementById("btnApplyDiscount").disabled = false;
  }
  if (cashReceived) cashReceived.value = "";
  if (saleError) saleError.hidden = true;
  renderCart();
}

function renderCart() {
  if (!cartBody) return;
  cartBody.innerHTML = "";

  cart.forEach((item) => {
    const subtotal = item.precioUnitario * item.cantidad;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(item.nombre)}</td>
      <td>
        <input type="number" min="0" step="100" value="${item.precioUnitario}" aria-label="Precio unitario de ${escapeHTML(item.nombre)}" style="width:95px;">
      </td>
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
    tr.querySelector('input[aria-label^="Precio unitario"]').addEventListener("change", (e) =>
      setUnitPrice(item.productId, e.target.value)
    );
    tr.querySelector('[data-action="dec"]').addEventListener("click", () => changeQty(item.productId, -1));
    tr.querySelector('[data-action="inc"]').addEventListener("click", () => changeQty(item.productId, 1));
    tr.querySelector('input[type="number"]:not([aria-label^="Precio unitario"])').addEventListener("change", (e) =>
      setQty(item.productId, e.target.value)
    );
    tr.querySelector(".icon-btn").addEventListener("click", () => removeFromCart(item.productId));
    cartBody.appendChild(tr);
  });

  if (cartEmpty) cartEmpty.hidden = cart.length > 0;
  updateTotals();
}

// ---------- Descuento (Opciones A y C: sin segundo descuento ni total negativo) ----------

function getSubtotal() {
  return cart.reduce((sum, item) => sum + item.precioUnitario * item.cantidad, 0);
}

function applyDiscount() {
  if (saleError) saleError.hidden = true;

  if (appliedDiscount > 0) {
    return showSaleError("Ya se aplicó un descuento a esta venta; no se admite un segundo descuento.");
  }

  const subtotal = getSubtotal();
  if (subtotal <= 0) {
    return showSaleError("Agrega productos antes de aplicar un descuento.");
  }

  const raw = Number(discountInput?.value);
  if (!isNonNegativeNumber(discountInput?.value) || Number.isNaN(raw) || raw <= 0) {
    return showSaleError("Ingresa un valor de descuento mayor a 0.");
  }

  const type = discountType?.value || "amount";
  const discountValue = type === "percent" ? Math.round((subtotal * raw) / 100) : raw;

  if (type === "percent" && raw > 100) {
    return showSaleError("El porcentaje de descuento no puede superar el 100%.");
  }

  if (discountValue > subtotal) {
    return showSaleError("El descuento no puede superar el subtotal ni generar un total negativo.");
  }

  appliedDiscount = discountValue;
  if (discountInput) discountInput.disabled = true;
  if (document.getElementById("btnApplyDiscount")) {
    document.getElementById("btnApplyDiscount").disabled = true;
  }

  showToast("Descuento aplicado.");
  updateTotals();
}

function getTotal() {
  const net = getSubtotal() - appliedDiscount;
  return net > 0 ? net : 0;
}

// ---------- Ventas abiertas en localStorage (Opción A) ----------

function readOpenSales() {
  try {
    const parsed = JSON.parse(localStorage.getItem(OPEN_SALES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOpenSales(list) {
  localStorage.setItem(OPEN_SALES_KEY, JSON.stringify(list));
  updateOpenSalesBadge();
}

function updateOpenSalesBadge() {
  if (openSalesCount) {
    openSalesCount.textContent = String(readOpenSales().length);
  }
}

function saveCurrentOpenSale() {
  if (saleError) saleError.hidden = true;
  if (cart.length === 0) {
    return showSaleError("El carrito está vacío; agrega productos para guardar una venta abierta.");
  }

  const list = readOpenSales();
  const saleRecord = {
    id: activeOpenSaleId || "abierta-" + Date.now(),
    fecha: new Date().toISOString(),
    clienteId: clientSelect?.value || "",
    appliedDiscount,
    items: cart.map((i) => ({ ...i })),
    total: getTotal(),
  };

  const idx = list.findIndex((s) => s.id === saleRecord.id);
  if (idx >= 0) {
    list[idx] = saleRecord;
  } else {
    list.push(saleRecord);
  }

  writeOpenSales(list);
  showToast("Venta guardada sin cobrar.");
  resetSaleState();
  renderOpenSalesList();
}

function toggleOpenSalesPanel() {
  if (!openSalesPanel) return;
  openSalesPanel.hidden = !openSalesPanel.hidden;
  if (!openSalesPanel.hidden) {
    renderOpenSalesList();
  }
}

function renderOpenSalesList() {
  if (!listaVentasAbiertas) return;
  const list = readOpenSales();
  listaVentasAbiertas.innerHTML = "";

  if (list.length === 0) {
    listaVentasAbiertas.innerHTML = `<p class="sr-meta">No hay ventas guardadas en espera.</p>`;
    return;
  }

  list.forEach((v) => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex; justify-content:space-between; align-items:center; gap:.5rem; padding:.35rem 0;";
    const itemCount = Array.isArray(v.items) ? v.items.reduce((acc, it) => acc + it.cantidad, 0) : 0;
    row.innerHTML = `
      <span style="font-size:.85rem;">${itemCount} ítem(s) · Total: <strong>${formatCOP(v.total)}</strong></span>
      <button type="button" class="btn btn--primary" style="padding:.3rem .65rem; font-size:.78rem;">Retomar</button>
    `;
    row.querySelector("button").addEventListener("click", () => {
      cart = v.items.map((i) => ({ ...i }));
      appliedDiscount = Number(v.appliedDiscount) || 0;
      activeOpenSaleId = v.id;
      if (clientSelect && v.clienteId) clientSelect.value = v.clienteId;
      if (discountInput) {
        discountInput.value = appliedDiscount > 0 ? String(appliedDiscount) : "";
        discountInput.disabled = appliedDiscount > 0;
      }
      if (document.getElementById("btnApplyDiscount")) {
        document.getElementById("btnApplyDiscount").disabled = appliedDiscount > 0;
      }
      if (openSalesPanel) openSalesPanel.hidden = true;
      renderCart();
      showToast("Venta retomada con sus ítems intactos.");
    });
    listaVentasAbiertas.appendChild(row);
  });
}

// ---------- Totales y método de pago (Opción B: "Debe" + cliente) ----------

function getSelectedMethod() {
  const checked = document.querySelector('input[name="metodoPago"]:checked');
  return checked ? checked.value : "Efectivo";
}

function syncCashFields() {
  const isCash = getSelectedMethod() === "Efectivo";
  if (cashFields) cashFields.classList.toggle("is-visible", isCash);
  updateTotals();
}

function updateTotals() {
  const subtotal = getSubtotal();
  const total = getTotal();

  if (sumSubtotal) sumSubtotal.textContent = formatCOP(subtotal);
  if (discountRow) discountRow.hidden = appliedDiscount <= 0;
  if (sumDiscount) sumDiscount.textContent = `-${formatCOP(appliedDiscount)}`;
  if (sumTotal) sumTotal.textContent = formatCOP(total);

  if (getSelectedMethod() === "Efectivo") {
    const received = Number(cashReceived?.value) || 0;
    const change = received - total;
    if (sumChange) sumChange.textContent = formatCOP(change > 0 ? change : 0);
  } else if (sumChange) {
    sumChange.textContent = formatCOP(0);
  }
}

// ---------- Confirmar venta ----------

async function confirmSale(e) {
  if (e) e.preventDefault();
  if (saleError) saleError.hidden = true;

  if (cart.length === 0) {
    return showSaleError("Agrega al menos un producto antes de confirmar la venta.");
  }

  const metodoPago = getSelectedMethod();
  const selectedClientId = clientSelect?.value;

  if (metodoPago === "Debe" && !selectedClientId) {
    return showSaleError('Debes asociar un cliente cuando el método de pago es "Debe".');
  }

  const subtotal = getSubtotal();
  const total = getTotal();
  if (subtotal - appliedDiscount < 0) {
    return showSaleError("El total de la venta no puede ser negativo.");
  }

  let valorRecibido = null;
  let cambio = 0;

  if (metodoPago === "Efectivo") {
    if (!isNonNegativeNumber(cashReceived?.value)) {
      return showSaleError("Ingresa el valor recibido en efectivo.");
    }
    valorRecibido = Number(cashReceived.value);
    if (valorRecibido < total) {
      return showSaleError("El valor recibido es menor que el total de la venta.");
    }
    cambio = valorRecibido - total;
  }

  let productsList = getProducts();
  if (productsList instanceof Promise) productsList = await productsList;
  const products = Array.isArray(productsList) ? productsList : [];

  for (const item of cart) {
    const product = products.find((p) => p.id === item.productId);
    if (product && product.seguimientoInventario) {
      const available = product.stock ?? 0;
      if (available < item.cantidad) {
        return showSaleError(`Stock insuficiente de "${product.nombre}" (disponible: ${available}, solicitado: ${item.cantidad}).`);
      }
    }
  }

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
            proveedor: 1,
          }),
        });
      } catch (err) {
        console.error("Error actualizando stock en el servidor:", err);
      }
    }
  }

  const ventaPayload = {
    total,
    descuento: appliedDiscount,
    metodo_pago: metodoPago,
    valor_recibido: valorRecibido,
    cambio,
    estado: "cerrada",
    cliente: selectedClientId ? Number(selectedClientId) : 1,
    usuario: 1,
    items: cart.map((i) => ({
      producto: i.productId,
      cantidad: i.cantidad,
      precio_unitario: i.precioUnitario,
    })),
  };

  try {
    await apiPost("ventas", ventaPayload);
  } catch (err) {
    console.error("Error al registrar la venta en Django:", err);
    return showSaleError("No se pudo registrar la venta en el servidor.");
  }

  if (activeOpenSaleId) {
    const remaining = readOpenSales().filter((s) => s.id !== activeOpenSaleId);
    writeOpenSales(remaining);
  }

  const sale = {
    id: "venta-" + Date.now(),
    numero: Math.floor(1000 + Math.random() * 9000),
    fecha: new Date().toISOString(),
    clienteId: selectedClientId || null,
    descuento: appliedDiscount,
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

  showToast(`Venta #${sale.numero} confirmada.`);
  resetSaleState();
  renderTicket(sale, { showConfirmBanner: true });
  showView("factura");
  window.dispatchEvent(new CustomEvent("sale:completed"));
}

function showSaleError(message) {
  if (!saleError) return;
  saleError.textContent = message;
  saleError.hidden = false;
}