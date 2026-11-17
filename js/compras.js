import { getCompras, createCompra, getProducts, updateProducto } from './storage.js';
import { showToast } from './utils.js';

export async function registrarCompra(proveedorId, itemsCompra) {
  if (!proveedorId) {
    alert("Debe seleccionar un proveedor.");
    return;
  }
  if (!itemsCompra || itemsCompra.length === 0) {
    alert("No hay productos en la compra.");
    return;
  }

  const compraData = {
    id: "compra-" + Date.now(),
    proveedorId: proveedorId,
    items: JSON.stringify(itemsCompra),
    total: itemsCompra.reduce((sum, item) => sum + (item.costo * item.cantidad), 0),
    fecha: new Date().toISOString()
  };

  try {
    // 1. Guardamos la compra en Google Sheets
    await createCompra(compraData);

    // 2. Actualizamos el stock de cada producto comprado de forma automática
    const productos = await getProducts();
    
    for (const itemCompra of itemsCompra) {
      const producto = productos.find(p => p.id === itemCompra.productoId);
      if (producto && producto.seguimientoInventario) {
        // Incrementamos el stock actual con la cantidad comprada
        producto.stock = (Number(producto.stock) || 0) + Number(itemCompra.cantidad);
        
        // Actualizamos el producto en el servidor
        await updateProducto(producto);
      }
    }

    showToast("Compra registrada y stock actualizado con éxito.");
  } catch (error) {
    console.error("Error al registrar la compra:", error);
    showToast("No se pudo registrar la compra en el servidor.", "error");
  }
}

export function initCompras() {
  const btnNew = document.getElementById("btnNewCompra");
  if (btnNew) {
    btnNew.addEventListener("click", () => {
      // Lógica para registrar nueva compra o abrir modal
      console.log("Nueva compra clickeada");
    });
  }
}

export async function renderComprasTable() {
  const tbody = document.getElementById("comprasBody");
  const emptyState = document.getElementById("comprasEmpty");
  if (!tbody) return;

  // Puedes conectar aquí tu llamada a la API de compras si la tienes lista
  tbody.innerHTML = "";
  if (emptyState) emptyState.hidden = false;
}