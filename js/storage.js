import { apiGet, apiPost } from './api.js';

// --- CATEGORÍAS ---
export async function getCategorias() {
  try {
    return await apiGet('categorias');
  } catch (e) {
    console.error("Error obteniendo categorías:", e);
    return [];
  }
}
export async function createCategoria(data) {
  return await apiPost('categorias', data);
}
export async function updateCategoria(data) {
  const res = await fetch(`http://127.0.0.1:8000/api/categorias/${data.id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await res.json();
}
export async function deleteCategoria(id) {
  const res = await fetch(`http://127.0.0.1:8000/api/categorias/${id}/`, {
    method: 'DELETE'
  });
  return true;
}

// --- CLIENTES ---
export async function getClientes() {
  try {
    return await apiGet('clientes');
  } catch (e) {
    console.error("Error obteniendo clientes:", e);
    return [];
  }
}
export async function createCliente(data) {
  return await apiPost('clientes', data);
}
export async function updateCliente(data) {
  const res = await fetch(`http://127.0.0.1:8000/api/clientes/${data.id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await res.json();
}
export async function deleteCliente(id) {
  const res = await fetch(`http://127.0.0.1:8000/api/clientes/${id}/`, {
    method: 'DELETE'
  });
  return true;
}

// --- PROVEEDORES ---
export async function getProveedores() {
  try {
    return await apiGet('proveedores');
  } catch (e) {
    console.error("Error obteniendo proveedores:", e);
    return [];
  }
}
export async function createProveedor(data) {
  return await apiPost('proveedores', data);
}
export async function updateProveedor(data) {
  const res = await fetch(`http://127.0.0.1:8000/api/proveedores/${data.id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return await res.json();
}
export async function deleteProveedor(id) {
  const res = await fetch(`http://127.0.0.1:8000/api/proveedores/${id}/`, {
    method: 'DELETE'
  });
  return true;
}

// ---------- Productos ----------
export async function getProducts() {
  try {
    const data = await apiGet('productos');
    // Mapeamos los campos del backend de Django a los nombres que espera productos.js
    return data.map(p => ({
      id: p.id,
      nombre: p.nombre,
      categoria: p.categoria,
      codigoInterno: p.codigo || `PL-${String(p.id).padStart(4, '0')}`,
      precioVenta: Number(p.precio),
      costo: Number(p.costo || 0),
      seguimientoInventario: true,
      stock: p.stock
    }));
  } catch (error) {
    console.error("Error al cargar productos:", error.message);
    return [];
  }
}

export async function createProducto(productoData) {
  try {
    const payload = {
      nombre: productoData.nombre,
      precio: productoData.precioVenta,
      costo: productoData.costo || 0,
      stock: productoData.stock || 0,
      categoria: Number(productoData.categoria) || 1,
      proveedor: 1 // Proveedor por defecto temporal
    };
    return await apiPost('productos', payload);
  } catch (error) {
    console.error("Error al crear producto:", error.message);
    throw error;
  }
}

export async function updateProducto(productoData) {
  try {
    const payload = {
      nombre: productoData.nombre,
      precio: productoData.precioVenta,
      costo: productoData.costo || 0,
      stock: productoData.stock || 0,
      categoria: Number(productoData.categoria) || 1,
      proveedor: 1
    };
    const res = await fetch(`http://127.0.0.1:8000/api/productos/${productoData.id}/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Error al actualizar producto en el servidor");
    return await res.json();
  } catch (error) {
    console.error("Error al actualizar producto:", error.message);
    throw error;
  }
}

export async function deleteProducto(idProducto) {
  try {
    const res = await fetch(`http://127.0.0.1:8000/api/productos/${idProducto}/`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error("Error al eliminar producto en el servidor");
    return true;
  } catch (error) {
    console.error("Error al eliminar producto:", error.message);
    throw error;
  }
}

// --- COMPRAS ---
export async function getCompras() {
  try {
    return await apiGet('compras');
  } catch (e) {
    return [];
  }
}

export async function createCompra(compraData) {
  return await apiPost('compras', compraData);
}

// --- VENTAS ---
export async function getSales() {
  try {
    return await apiGet('ventas');
  } catch (e) {
    return [];
  }
}

export async function createSale(saleData) {
  return await apiPost('ventas', saleData);
}

export async function updateSale(saleData) {
  const res = await fetch(`http://127.0.0.1:8000/api/ventas/${saleData.id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saleData)
  });
  return await res.json();
}

export async function deleteSale(id) {
  const res = await fetch(`http://127.0.0.1:8000/api/ventas/${id}/`, {
    method: 'DELETE'
  });
  return true;
}

// ---------- Contadores ----------
export async function nextProductCode() {
  const products = await getProducts();
  const numero = (products ? products.length : 0) + 1;
  return `PL-${String(numero).padStart(4, "0")}`;
}   

export async function nextSaleNumber() {
  const sales = await getSales();
  const numero = (sales ? sales.length : 0) + 1;
  return numero;
}

export function makeId() {
  return "id-" + Date.now();
}