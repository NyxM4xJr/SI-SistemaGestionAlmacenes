const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

export interface ReporteComparativaItem {
  insumo: string;
  proveedor: string;
  temporada: string;
  mes: string;
  anio: number;
  precio_promedio: number;
}

export const getReporteComparativa = async (insumoId?: string, temporada?: string, anio?: string): Promise<ReporteComparativaItem[]> => {
  const params = new URLSearchParams();
  if (insumoId) params.append('insumo_id', insumoId);
  if (temporada) params.append('temporada', temporada);
  if (anio) params.append('anio', anio);
  
  const res = await fetch(`${API_URL}/reportes/comparativa-precios/?${params.toString()}`, {
    headers: headers(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al obtener datos");
  return data;
};

export const descargarReportePDF = async (insumoId?: string, temporada?: string, anio?: string) => {
  const params = new URLSearchParams();
  if (insumoId) params.append('insumo_id', insumoId);
  if (temporada) params.append('temporada', temporada);
  if (anio) params.append('anio', anio);
  
  const res = await fetch(`${API_URL}/reportes/comparativa-precios/pdf/?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });
  
  if (!res.ok) throw new Error("Error al descargar PDF");
  const blob = await res.blob();
  
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Reporte_Comparativa_Precios.pdf');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const descargarReporteExcel = async (insumoId?: string, temporada?: string, anio?: string) => {
  const params = new URLSearchParams();
  if (insumoId) params.append('insumo_id', insumoId);
  if (temporada) params.append('temporada', temporada);
  if (anio) params.append('anio', anio);
  
  const res = await fetch(`${API_URL}/reportes/comparativa-precios/excel/?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });
  
  if (!res.ok) throw new Error("Error al descargar Excel");
  const blob = await res.blob();
  
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Reporte_Comparativa_Precios.xlsx');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
