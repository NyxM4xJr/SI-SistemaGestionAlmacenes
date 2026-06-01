/* ============================================================
 * ARCHIVO: frontend/src/services/stockService.ts
 * CASO DE USO: CU12 - Gestionar Stock
 * CICLO: 2
 * FECHA: 10/05/26
 * AUTOR: Marcos
 * DESCRIPCIÓN: Servicio de comunicación con la API de stock.
 * ============================================================
 */

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

    export interface Stock {
    id?: number;
    cantidad: number;
    stock_min: number;
    stock_max: number;

    insumo_id: number;
    inventario_id: number;

    insumo?: {
        nombre: string;
    };
    }




const getToken = () => localStorage.getItem("access_token");

    const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
    });

    export const StockService = {

        getAll: async (): Promise<Stock[]> => {

            const res = await fetch(`${API_URL}/stock/`, {
                headers: headers(),
            });

            if (!res.ok) {
                throw new Error("Error al cargar stock");
            }

            return res.json();
        },

    getById: async (id: number): Promise<Stock> => {
        const res = await fetch(`${API_URL}/stock/${id}/`, {
        headers: headers(),
        });

        if (!res.ok) {
        throw new Error("Stock no encontrado");
        }

        return res.json();
    },

    create: async (data: Stock): Promise<Stock> => {
        const res = await fetch(`${API_URL}/stock/`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(data),
        });

        if (!res.ok) {
        throw new Error("Error al crear stock");
        }

        return res.json();
    },

    update: async (id: number, data: Partial<Stock>): Promise<Stock> => {
        const res = await fetch(`${API_URL}/stock/${id}/`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(data),
        });

        if (!res.ok) {
        throw new Error("Error al actualizar stock");
        }

        return res.json();
    },

    delete: async (id: number): Promise<void> => {
        const res = await fetch(`${API_URL}/stock/${id}/`, {
        method: "DELETE",
        headers: headers(),
        });

        if (!res.ok) {
        throw new Error("Error al eliminar stock");
        }
    },
}