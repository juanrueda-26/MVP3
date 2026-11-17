
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000/api'
    : 'https://tu-backend-en-render.onrender.com/api'; // Reemplazarás esto cuando despliegues


export async function apiGet(resource) {
    try {
        const res = await fetch(`${API_URL}/${resource}/`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        });
        
        if (!res.ok) {
            throw new Error(`Error HTTP: ${res.status}`);
        }
        
        return await res.json();
    } catch (e) {
        throw new Error(`No se pudo conectar con el servidor (${resource}): ${e.message}`);
    }
}


export async function apiPost(resource, data) {
    try {
        const res = await fetch(`${API_URL}/${resource}/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data)
        });

        const jsonResponse = await res.json();

        if (!res.ok) {
            throw new Error(JSON.stringify(jsonResponse) || "Error al procesar la solicitud");
        }

        return jsonResponse;
    } catch (e) {
        throw new Error(`Error en la petición POST (${resource}): ${e.message}`);
    }
}


export async function apiPut(resource, id, data) {
    try {
        const res = await fetch(`${API_URL}/${resource}/${id}/`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data)
        });

        const jsonResponse = await res.json();

        if (!res.ok) {
            throw new Error(JSON.stringify(jsonResponse) || "Error al actualizar");
        }

        return jsonResponse;
    } catch (e) {
        throw new Error(`Error en la petición PUT (${resource}): ${e.message}`);
    }
}