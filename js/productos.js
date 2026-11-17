import { apiGet, apiPost } from "./api.js";

// --- PRODUCTOS ---
export async function getProducts() {
  try {
    const data = await apiGet("productos");
    // Adaptamos los campos si el backend los devuelve con otro nombre
    return data.map(p => ({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria, // ID o nombre según prefieras
      codigoInterno: p.codigo || p.id,
      precioVenta: p.precio,
      costo: p.costo || 0,
      seguimientoInventario: true,
      stock: p.stock
    }));
  } catch (e) {
    console.error("Error obteniendo productos:", e);
    return [];
  }
}

export async function createProducto(productoData) {
  // Mapeamos al formato que espera el modelo de Django
  const payload = {
    nombre: productoData.nombre,
    precio: productoData.precioVenta,
    costo: productoData.costo || 0,
    stock: productoData.stock || 0,
    categoria: Number(productoData.categoria) || 1,
    proveedor: 1 // Proveedor por defecto temporal
  };
  return await apiPost("productos", payload);
}

export async function updateProducto(productoData) {
  const payload = {
    nombre: productoData.nombre,
    precio: productoData.precioVenta,
    costo: productoData.costo || 0,
    stock: productoData.stock || 0,
    categoria: Number(productoData.categoria) || 1,
    proveedor: 1
  };
  
  const res = await fetch(`http://127.0.0.1:8000/api/productos/${productoData.id}/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Error al actualizar producto");
  return await res.json();
}

export async function deleteProducto(id) {
  const res = await fetch(`http://127.0.0.1:8000/api/productos/${id}/`, {
    method: "DELETE"
  });
  if (!res.ok) throw new Error("Error al eliminar producto");
  return true;
}

// --- CATEGORÍAS ---
export async function getCategorias() {
  try {
    return await apiGet("categorias");
  } catch (e) {
    console.error("Error obteniendo categorías:", e);
    return [];
  }
}

// Utilidades locales de IDs si se requieren
export function makeId() {
  return "prod-" + Date.now();
}

export function nextProductCode() {
  return "P-" + Math.floor(1000 + Math.random() * 9000);
}

export async function renderProductsTable() {
  const tbody = document.getElementById("productsBody");
  const emptyState = document.getElementById("productsEmpty");
  if (!tbody) return;

  const products = await getProducts();
  tbody.innerHTML = "";

  if (products.length === 0) {
    if (emptyState) emptyState.hidden = false;
    return;
  }
  if (emptyState) emptyState.hidden = true;

  products.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.codigoInterno}</td>
      <td><strong>${p.nombre}</strong></td>
      <td>${p.categoria}</td>
      <td>$${Number(p.precioVenta).toLocaleString()}</td>
      <td>$${Number(p.costo).toLocaleString()}</td>
      <td>${p.stock}</td>
      <td>
        <button class="btn-icon" data-delete="${p.id}" title="Eliminar">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

export function initProducts() {
  const btnNew = document.getElementById("btnNewProduct");
  const modal = document.getElementById("productModalBackdrop");
  const btnClose = document.getElementById("btnCloseModal");
  const btnCancel = document.getElementById("btnCancelProduct");
  const form = document.getElementById("productForm");

  if (btnNew && modal) {
    btnNew.addEventListener("click", () => {
      document.getElementById("productModalTitle").textContent = "Nuevo producto";
      document.getElementById("productId").value = "";
      if (form) form.reset();
      modal.hidden = false;
    });
  }

  if (btnClose && modal) btnClose.addEventListener("click", () => modal.hidden = true);
  if (btnCancel && modal) btnCancel.addEventListener("click", () => modal.hidden = true);

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const productoData = {
        nombre: document.getElementById("fNombre").value,
        categoria: document.getElementById("fCategoria").value,
        codigo: document.getElementById("fCodigo").value,
        precioVenta: Number(document.getElementById("fPrecio").value),
        costo: Number(document.getElementById("fCosto").value),
        stock: Number(document.getElementById("fStock").value)
      };

      try {
        await createProducto(productoData);
        modal.hidden = true;
        renderProductsTable();
      } catch (err) {
        console.error("Error al guardar producto:", err);
      }
    });
  }

  const tbody = document.getElementById("productsBody");
  if (tbody) {
    tbody.addEventListener("click", async (e) => {
      const deleteId = e.target.getAttribute("data-delete");
      if (deleteId) {
        if (confirm("¿Estás seguro de eliminar este producto?")) {
          try {
            await deleteProducto(deleteId);
            renderProductsTable();
          } catch (err) {
            console.error("Error al eliminar:", err);
          }
        }
      }
    });
  }
}