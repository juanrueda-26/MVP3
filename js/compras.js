import { apiGet, apiPost } from "./api.js";
import { getProducts, renderProductsTable } from "./productos.js";
import { formatCOP, showToast } from "./utils.js";

const API_BASE = "http://127.0.0.1:8000/api";
const LOCAL_FALTANTES_KEY = "papel_y_luna_faltantes_v1";
const LOCAL_COMPRAS_KEY = "papel_y_luna_compras_v1";

let faltantesCache = [];
let comprasCache = [];

export async function initCompras() {
  const btnNewCompra = document.getElementById("btnNewCompra");
  const modal = document.getElementById("compraModalBackdrop");
  const btnClose = document.getElementById("btnCloseCompraModal");
  const btnCancel = document.getElementById("btnCancelCompra");
  const form = document.getElementById("compraForm");
  const cProducto = document.getElementById("cProducto");
  const cCosto = document.getElementById("cCostoUnitario");

  const btnNewFaltante = document.getElementById("btnNewFaltante");

  if (btnNewCompra && modal) {
    btnNewCompra.addEventListener("click", async () => {
      await populateSelectors();
      if (form) form.reset();
      hideError("compraFormError");
      modal.hidden = false;
    });
  }

  if (cProducto && cCosto) {
    cProducto.addEventListener("change", async () => {
      const products = await getProducts();
      const selected = products.find((p) => String(p.id) === String(cProducto.value));
      if (selected && selected.costo) {
        cCosto.value = selected.costo;
      }
    });
  }

  if (btnClose && modal) btnClose.addEventListener("click", () => (modal.hidden = true));
  if (btnCancel && modal) btnCancel.addEventListener("click", () => (modal.hidden = true));

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleCompraSubmit(modal, form);
    });
  }

  if (btnNewFaltante) {
    btnNewFaltante.addEventListener("click", handleCreateFaltante);
  }

  await populateSelectors();
  await renderComprasTable();
  await renderFaltantesTable();
}

async function populateSelectors() {
  const products = await getProducts();
  let proveedores = [];
  try {
    const res = await apiGet("proveedores");
    proveedores = Array.isArray(res) ? res : [];
  } catch {
    proveedores = [];
  }

  const cProducto = document.getElementById("cProducto");
  const fProducto = document.getElementById("faltanteProductoSelect");
  const cProveedor = document.getElementById("cProveedor");
  const fProveedor = document.getElementById("faltanteProveedorSelect");

  if (cProducto) {
    cProducto.innerHTML = `<option value="">— Seleccionar producto —</option>`;
    products.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.nombre} (Stock actual: ${p.stock ?? 0})`;
      cProducto.appendChild(opt);
    });
  }

  if (fProducto) {
    fProducto.innerHTML = `<option value="">— Seleccionar producto con poco stock —</option>`;
    products.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.nombre} (Stock: ${p.stock ?? 0})`;
      fProducto.appendChild(opt);
    });
  }

  if (cProveedor) {
    cProveedor.innerHTML = `<option value="">— Seleccionar proveedor —</option>`;
    proveedores.forEach((pr) => {
      const opt = document.createElement("option");
      opt.value = pr.id;
      opt.textContent = pr.nombre;
      cProveedor.appendChild(opt);
    });
  }

  if (fProveedor) {
    fProveedor.innerHTML = `<option value="">— Proveedor (opcional) —</option>`;
    proveedores.forEach((pr) => {
      const opt = document.createElement("option");
      opt.value = pr.id;
      opt.textContent = pr.nombre;
      fProveedor.appendChild(opt);
    });
  }
}

async function handleCompraSubmit(modal, form) {
  hideError("compraFormError");
  const proveedorId = Number(document.getElementById("cProveedor")?.value);
  const productoId = Number(document.getElementById("cProducto")?.value);
  const cantidad = Number(document.getElementById("cCantidad")?.value);
  const costoUnitario = Number(document.getElementById("cCostoUnitario")?.value) || 0;

  if (!proveedorId || !productoId || cantidad < 1) {
    return showError("compraFormError", "Selecciona proveedor, producto y una cantidad válida (mínimo 1).");
  }

  const products = await getProducts();
  const product = products.find((p) => Number(p.id) === productoId);
  if (!product) {
    return showError("compraFormError", "Producto no encontrado.");
  }

  const newStock = (Number(product.stock) || 0) + cantidad;
  const totalCompra = cantidad * costoUnitario;

  try {
    const res = await fetch(`${API_BASE}/productos/${product.id}/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: product.nombre,
        precio: product.precioVenta,
        costo: costoUnitario || product.costo || 0,
        stock: newStock,
        categoria: Number(product.categoria) || 1,
        proveedor: proveedorId,
      }),
    });
    if (!res.ok) throw new Error("No se pudo actualizar el stock del producto.");
  } catch (err) {
    console.error(err);
    return showError("compraFormError", "Error al subir el stock del producto en el servidor.");
  }

  try {
    await apiPost("compras", {
      proveedor: proveedorId,
      producto: productoId,
      cantidad,
      costo_unitario: costoUnitario,
      total: totalCompra,
    });
  } catch {
    // Respaldo local si el endpoint de compras no está expuesto en DRF
  }

  const compras = readLocal(LOCAL_COMPRAS_KEY);
  compras.unshift({
    id: "cmp-" + Date.now(),
    referencia: "OC-" + Math.floor(1000 + Math.random() * 9000),
    proveedorId,
    productoId,
    productoNombre: product.nombre,
    cantidad,
    total: totalCompra,
    fecha: new Date().toISOString(),
  });
  writeLocal(LOCAL_COMPRAS_KEY, compras);

  if (modal) modal.hidden = true;
  if (form) form.reset();

  showToast(`Compra registrada: stock de "${product.nombre}" actualizado a ${newStock}.`);
  await renderProductsTable();
  await populateSelectors();
  await renderComprasTable();
}

async function renderComprasTable() {
  const tbody = document.getElementById("comprasBody");
  const empty = document.getElementById("comprasEmpty");
  if (!tbody) return;

  let compras = [];
  try {
    const apiData = await apiGet("compras");
    if (Array.isArray(apiData) && apiData.length > 0) {
      compras = apiData;
    }
  } catch {
    compras = [];
  }

  const localCompras = readLocal(LOCAL_COMPRAS_KEY);
  const list = compras.length > 0 ? compras : localCompras;
  comprasCache = list;

  tbody.innerHTML = "";
  if (list.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  list.forEach((c) => {
    const tr = document.createElement("tr");
    const ref = c.referencia || `#${c.id}`;
    const prov = c.proveedor_nombre || `Proveedor #${c.proveedor ?? c.proveedorId ?? 1}`;
    const fechaTxt = c.fecha ? new Date(c.fecha).toLocaleDateString() : "Hoy";
    tr.innerHTML = `
      <td>${escapeHTML(ref)}</td>
      <td>${escapeHTML(prov)}</td>
      <td>${formatCOP(Number(c.total) || 0)}</td>
      <td>${escapeHTML(fechaTxt)}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function handleCreateFaltante() {
  const prodSelect = document.getElementById("faltanteProductoSelect");
  const qtyInput = document.getElementById("faltanteCantidad");
  const provSelect = document.getElementById("faltanteProveedorSelect");

  const productoId = Number(prodSelect?.value);
  const cantidad = Number(qtyInput?.value);
  const proveedorId = provSelect?.value ? Number(provSelect.value) : null;

  if (!productoId || cantidad < 1) {
    showToast("Selecciona un producto y una cantidad faltante mayor a 0.");
    return;
  }

  const products = await getProducts();
  const product = products.find((p) => Number(p.id) === productoId);
  const payload = {
    producto: productoId,
    cantidad,
    proveedor: proveedorId,
    resuelto: false,
  };

  let created = null;
  try {
    created = await apiPost("faltantes", payload);
  } catch {
    created = null;
  }

  const localFaltantes = readLocal(LOCAL_FALTANTES_KEY);
  localFaltantes.unshift({
    id: created?.id ?? "falt-" + Date.now(),
    productoId,
    productoNombre: product?.nombre || `Producto #${productoId}`,
    cantidad,
    proveedorId,
    resuelto: false,
  });
  writeLocal(LOCAL_FALTANTES_KEY, localFaltantes);

  if (qtyInput) qtyInput.value = "";
  showToast(`Faltante registrado para "${product?.nombre || "producto"}".`);
  await renderFaltantesTable();
}

async function renderFaltantesTable() {
  const tbody = document.getElementById("faltantesBody");
  const empty = document.getElementById("faltantesEmpty");
  if (!tbody) return;

  let apiFaltantes = [];
  try {
    const res = await apiGet("faltantes");
    if (Array.isArray(res)) apiFaltantes = res;
  } catch {
    apiFaltantes = [];
  }

  const localFaltantes = readLocal(LOCAL_FALTANTES_KEY);
  const products = await getProducts();

  const merged = localFaltantes.length > 0 ? localFaltantes : apiFaltantes;
  faltantesCache = merged;

  tbody.innerHTML = "";
  if (merged.length === 0) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  merged.forEach((f) => {
    const prodId = f.productoId ?? f.producto;
    const prod = products.find((p) => Number(p.id) === Number(prodId));
    const prodName = f.productoNombre || f.producto_nombre || prod?.nombre || `Producto #${prodId}`;
    const provName = f.proveedor_nombre || (f.proveedorId || f.proveedor ? `Proveedor #${f.proveedorId ?? f.proveedor}` : "—");
    const isResolved = Boolean(f.resuelto);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHTML(prodName)}</strong></td>
      <td>${Number(f.cantidad) || 1}</td>
      <td>${escapeHTML(provName)}</td>
      <td>${isResolved ? "Resuelto" : "Pendiente"}</td>
      <td>
        ${
          isResolved
            ? `<span class="sr-meta">Completado</span>`
            : `<button type="button" class="btn btn--primary" data-resolve="${escapeHTML(f.id)}" style="padding:.35rem .7rem; font-size:.78rem;">Marcar resuelto</button>`
        }
      </td>
    `;

    const btnResolve = tr.querySelector("[data-resolve]");
    if (btnResolve) {
      btnResolve.addEventListener("click", () => markFaltanteResuelto(f.id));
    }

    tbody.appendChild(tr);
  });
}

async function markFaltanteResuelto(id) {
  const localFaltantes = readLocal(LOCAL_FALTANTES_KEY);
  const updated = localFaltantes.map((item) =>
    String(item.id) === String(id) ? { ...item, resuelto: true } : item
  );
  writeLocal(LOCAL_FALTANTES_KEY, updated);

  if (typeof id === "number" || /^\d+$/.test(String(id))) {
    try {
      await fetch(`${API_BASE}/faltantes/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resuelto: true }),
      });
    } catch {
      // Si el backend no tiene PATCH habilitado, permanece marcado en estado local
    }
  }

  showToast("Faltante marcado como resuelto.");
  await renderFaltantesTable();
}

function readLocal(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

function hideError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = "";
  el.hidden = true;
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}