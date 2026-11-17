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