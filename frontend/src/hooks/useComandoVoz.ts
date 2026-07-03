/**
 * ============================================================
 * ARCHIVO: frontend/src/hooks/useComandoVoz.ts
 * CASO DE USO: CU32 - Reportes por Voz con IA
 * CICLO: 4
 * AUTOR: Mateo Hurtado
 * FECHA: 21/06/26
 * ÚLTIMA MODIFICACIÓN: 21/06/26 — (1) parser de palabras clave
 *   ampliado con sinónimos y frases naturales completas, con
 *   normalización de tildes; (2) descarga DIRECTA de PDF/Excel
 *   cuando el comando especifica formato, en vez de solo resaltar
 *   el botón (ver punto "DESCARGA DIRECTA" abajo).
 *
 * DESCRIPCIÓN: Hook que encapsula toda la lógica del "Control"
 * de CU32 (CCComandoVoz en el diagrama de clases): captura de
 * audio vía Web Speech API del navegador, interpretación del
 * texto transcrito por coincidencia de palabras/frases clave,
 * descarga directa de reportes cuando corresponde, y registro de
 * bitácora. La navegación queda a cargo de quien use el hook
 * (AppHeader).
 *
 * ------------------------------------------------------------
 * DESCARGA DIRECTA (decisión de sesión de diseño, revisión
 * posterior a Fase 3): si el comando incluye un formato ("pdf" /
 * "excel") Y el destino es un reporte descargable (CU25, CU26,
 * CU27 — NO CU29, que es solo visualización en pantalla), el
 * hook dispara la descarga directamente (sin esperar a que el
 * usuario llegue a la página y haga clic), usando las funciones
 * de descarga YA EXISTENTES de cada servicio
 * (reporteValorPerdidoService, reporteCostosService,
 * reporteRotacionService), SIN filtros (reporte completo — ej.
 * "todos los platos"). Después de iniciar la descarga, se
 * navega igual a la página del reporte, para que el usuario vea
 * el contexto de lo que acaba de descargar.
 * Si el comando NO especifica formato, el comportamiento es el
 * de antes: solo navegar (sin descargar nada).
 * ------------------------------------------------------------
 *
 * ------------------------------------------------------------
 * LÍMITES REALES (documentar explícitamente para la defensa):
 * "IA" en este CU se refiere ÚNICAMENTE al reconocimiento de voz
 * nativo del navegador (Web Speech API), que sí usa modelos de
 * machine learning de Google/Chrome para transcribir audio a
 * texto. La INTERPRETACIÓN de esa transcripción (decidir a qué
 * reporte ir y si descargar) sigue siendo un parser determinístico
 * de palabras y frases clave — NO hay un modelo de lenguaje (LLM)
 * propio analizando la intención del usuario. Esta limitación se
 * adoptó deliberadamente para no depender de una API de pago ni
 * de latencia de red en una interacción de voz que debe sentirse
 * instantánea.
 * ------------------------------------------------------------
 *
 * Filtrado por rol (decisión de sesión de diseño Fase 3): los
 * comandos hacia reportes que el rol actual no puede ver se
 * excluyen ANTES de interpretar, igual criterio que el sidebar
 * (menuConfig.ts) ya aplica para ocultar nodos por rol.
 * ============================================================
 */

import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Role } from "@/context/AuthContext";
import { descargarReporteValorPerdidoPDF, descargarReporteValorPerdidoExcel } from "@/services/reporteValorPerdidoService";
import { descargarReportePDF as descargarCostosPDF, descargarReporteExcel as descargarCostosExcel } from "@/services/reporteCostosService";
import { descargarRotacionPDF, descargarRotacionExcel } from "@/services/reporteRotacionService";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const getToken = () => localStorage.getItem("access_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// ── Tipos ────────────────────────────────────────────────────

export type FormatoDetectado = "pdf" | "excel" | null;

interface ComandoDestino {
  cuDestino: string;
  ruta: string;
  /** Palabras y frases clave que disparan este destino (sin tildes, en minúsculas). */
  palabrasClave: string[];
  /** Roles que pueden ver este reporte (mismo criterio que menuConfig.ts). */
  rolesPermitidos: Role[];
  /** Si es true, el formato detectado (pdf/excel) dispara descarga directa. CU29 (dashboard) es false: no tiene archivos. */
  descargable: boolean;
}

interface ComandoInterpretado {
  cuDestino: string;
  ruta: string;
  formato: FormatoDetectado;
  descargable: boolean;
}

/**
 * Quita tildes/diacríticos y normaliza a minúsculas, para que
 * "pérdidas", "perdidas" y una transcripción imperfecta de Web
 * Speech API como "perdidaz" (raro, pero pasa) tengan más chance
 * de coincidir contra la misma palabra clave base.
 */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remueve diacríticos (acentos)
}

// Mapeo de comandos -> destino, con sus roles permitidos
// (CU25/CU29: administrador+gerente. CU27: + chef, igual que su ruta real.
// CU26: administrador+gerente, mismo criterio que CU25 — son ambos reportes
// de análisis interno, no operativos del día a día del Chef).
// Las palabras clave están en minúsculas y SIN tildes (normalizar()
// se aplica también a la transcripción antes de comparar).
const COMANDOS_DESTINO: ComandoDestino[] = [
  {
    cuDestino: "CU25",
    ruta: "/reportes/valor-perdido",
    palabrasClave: [
      "valor perdido",
      "valor perdidas",
      "perdidas",
      "perdida",
      "mermas",
      "merma",
      "lo que se perdio",
      "lo que perdimos",
      "cuanto perdimos",
      "reporte de perdidas",
      "reporte de mermas",
    ],
    rolesPermitidos: ["administrador", "gerente"],
    descargable: true,
  },
  {
    cuDestino: "CU26",
    ruta: "/reportes/rotacion",
    palabrasClave: [
      "rotacion",
      "rotacion de inventario",
      "reporte de rotacion",
      "que tan rapido se mueve",
      "que insumos rotan mas",
      "rotacion de insumos",
    ],
    rolesPermitidos: ["administrador", "gerente"],
    descargable: true,
  },
  {
    cuDestino: "CU27",
    ruta: "/reportes/costos",
    palabrasClave: [
      "costos",
      "costo",
      "costo por plato",
      "costo de platos",
      "costo de los platos",
      "cuanto cuesta",
      "cuanto nos cuesta",
      "margen",
      "rentabilidad",
      "reporte de costos",
    ],
    rolesPermitidos: ["administrador", "gerente", "chef"],
    descargable: true,
  },
  {
    cuDestino: "CU29",
    ruta: "/dashboard",
    palabrasClave: [
      "dashboard",
      "kpis",
      "kpi",
      "indicadores",
      "panel",
      "panel de control",
      "resumen general",
      "como va el negocio",
      "como vamos",
      "estado general",
    ],
    rolesPermitidos: ["administrador", "gerente"],
    descargable: false, // solo visualización en pantalla, no genera archivos
  },
];

const PALABRAS_FORMATO_PDF = ["pdf", "en pdf", "formato pdf"];
const PALABRAS_FORMATO_EXCEL = ["excel", "en excel", "formato excel", "hoja de calculo", "xlsx"];

// Funciones de descarga reales de cada CU, indexadas por cuDestino.
// Se llaman SIN filtros (reporte completo: "todos los platos", todo el
// histórico de mermas/rotación), porque el comando de voz no especifica
// fechas ni insumo concretos.
const DESCARGAS_POR_CU: Record<
  string,
  { pdf: () => Promise<void>; excel: () => Promise<void> }
> = {
  CU25: {
    pdf: () => descargarReporteValorPerdidoPDF(),
    excel: () => descargarReporteValorPerdidoExcel(),
  },
  CU26: {
    pdf: () => descargarRotacionPDF(),
    excel: () => descargarRotacionExcel(),
  },
  CU27: {
    pdf: () => descargarCostosPDF(),
    excel: () => descargarCostosExcel(),
  },
};

/**
 * Interpreta la transcripción de voz contra los comandos disponibles
 * para el rol actual. Devuelve null si no se reconoció ningún comando.
 *
 * Si más de un destino coincide en la misma frase (caso raro, pero
 * posible con frases largas), se elige el que tiene MÁS coincidencias
 * de palabras clave, no simplemente el primero del array — una
 * heurística simple de desambiguación, sin involucrar ningún modelo.
 */
function interpretarComando(
  transcripcion: string,
  rol: Role
): ComandoInterpretado | null {
  const texto = normalizar(transcripcion);

  const comandosDisponibles = COMANDOS_DESTINO.filter((c) =>
    c.rolesPermitidos.includes(rol)
  );

  let mejorDestino: ComandoDestino | null = null;
  let mejorPuntaje = 0;

  for (const candidato of comandosDisponibles) {
    const puntaje = candidato.palabrasClave.filter((palabra) =>
      texto.includes(normalizar(palabra))
    ).length;

    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorDestino = candidato;
    }
  }

  if (!mejorDestino) return null;

  let formato: FormatoDetectado = null;
  if (PALABRAS_FORMATO_PDF.some((p) => texto.includes(normalizar(p)))) {
    formato = "pdf";
  } else if (PALABRAS_FORMATO_EXCEL.some((p) => texto.includes(normalizar(p)))) {
    formato = "excel";
  }

  return {
    cuDestino: mejorDestino.cuDestino,
    ruta: mejorDestino.ruta,
    formato,
    descargable: mejorDestino.descargable,
  };
}

/** POST /api/bitacora/log-accion-voz/ — registra el comando reconocido */
async function registrarComandoVoz(
  transcripcion: string,
  cuDestino: string,
  formatoDetectado: FormatoDetectado
): Promise<void> {
  try {
    await fetch(`${API_URL}/bitacora/log-accion-voz/`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        transcripcion,
        cu_destino: cuDestino,
        formato_detectado: formatoDetectado,
      }),
    });
  } catch {
    // Silencioso: un fallo de auditoría no debe interrumpir la
    // navegación que ya ocurrió — mismo criterio que registrar_accion()
    // aplica del lado del backend.
  }
}

// Tipado mínimo de la Web Speech API (no está en lib.dom.d.ts por defecto)
interface SpeechRecognitionResultLike {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}

export function useComandoVoz(rolActual: Role | undefined) {
  const navigate = useNavigate();
  const [escuchando, setEscuchando] = useState(false);
  const reconocimientoRef = useRef<any>(null);

  const soportado =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const iniciarReconocimiento = useCallback(() => {
    if (!soportado) {
      toast.error("Tu navegador no soporta reconocimiento de voz. Usa Chrome.");
      return;
    }
    if (!rolActual) return;

    // F1 (alt): soporte ya validado arriba.
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const reconocimiento = new SpeechRecognitionCtor();
    reconocimiento.lang = "es-BO";
    reconocimiento.continuous = false;
    reconocimiento.interimResults = false;

    reconocimiento.onstart = () => setEscuchando(true);
    reconocimiento.onend = () => setEscuchando(false);

    reconocimiento.onerror = (event: any) => {
      setEscuchando(false);
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        toast.error("Permiso de micrófono denegado.");
      } else if (event.error === "no-speech") {
        toast.info("No se detectó ningún comando de voz.");
      } else {
        toast.error("Error al capturar el comando de voz.");
      }
    };

    reconocimiento.onresult = (event: SpeechRecognitionResultLike) => {
      const transcripcion = event.results[0][0].transcript;

      // F2 (alt): comando reconocido / no reconocido
      const interpretado = interpretarComando(transcripcion, rolActual);

      if (!interpretado) {
        toast.info(
          `No se reconoció ningún comando válido. Intenta: "cuánto perdimos este mes", "cuánto cuestan los platos", "cómo va el negocio"...`
        );
        return;
      }

      // F3 (critical): registrar bitácora — no se espera la respuesta
      // para no demorar la navegación, igual principio que descargarBlob
      // no bloquea la UI esperando confirmaciones secundarias.
      registrarComandoVoz(transcripcion, interpretado.cuDestino, interpretado.formato);

      // F2b (alt anidado) — descarga directa SOLO si el destino es
      // descargable (no CU29) Y el comando especificó un formato.
      // Si no hay formato, el comportamiento es navegar nomás (sin
      // descargar nada) — igual que antes de esta revisión.
      if (interpretado.formato && interpretado.descargable) {
        const descargas = DESCARGAS_POR_CU[interpretado.cuDestino];
        const ejecutarDescarga =
          interpretado.formato === "pdf" ? descargas?.pdf : descargas?.excel;

        if (ejecutarDescarga) {
          toast.success(
            `Generando reporte de ${interpretado.cuDestino} en ${interpretado.formato.toUpperCase()}...`
          );
          ejecutarDescarga().catch(() => {
            toast.error("No se pudo generar el reporte solicitado por voz.");
          });
        }
      } else if (interpretado.formato) {
        // Comando con formato pero hacia un destino NO descargable
        // (CU29/Dashboard no tiene archivos) — se ignora el formato
        // y solo se navega.
        toast.success(`Comando reconocido: ir a ${interpretado.cuDestino}`);
      } else {
        toast.success(`Comando reconocido: ir a ${interpretado.cuDestino}`);
      }

      // La navegación ocurre SIEMPRE (con o sin descarga), para que el
      // usuario vea el contexto del reporte correspondiente — decisión
      // de sesión de diseño tras revisar el comportamiento de descarga
      // directa.
      navigate(interpretado.ruta, {
        state: { formatoSugerido: interpretado.formato },
      });
    };

    reconocimientoRef.current = reconocimiento;
    reconocimiento.start();
  }, [soportado, rolActual, navigate]);

  return { soportado, escuchando, iniciarReconocimiento };
}