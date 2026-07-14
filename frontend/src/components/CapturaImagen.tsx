/**
 * ============================================================
 * ARCHIVO: frontend/src/components/CapturaImagen.tsx
 * CASOS DE USO: CU39 (OCR de facturas) y CU42 (escaneo de etiquetas)
 * CICLO: 6
 *
 * DESCRIPCIÓN: Componente reutilizable de captura de imagen. Ofrece
 * dos modos:
 *   - Webcam en vivo (getUserMedia → <video> → captura de frame en
 *     <canvas> → data URL base64).
 *   - Subida de archivo (input file), respaldo confiable para la demo.
 * Devuelve el data URL base64 por el callback onCaptura.
 * ============================================================
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Upload, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface CapturaImagenProps {
  /** Se llama con el data URL base64 (data:image/jpeg;base64,...). */
  onCaptura: (dataUrl: string) => void;
  /** Texto del botón principal (ej: "Analizar factura"). */
  etiquetaAccion?: string;
  /** Deshabilita los controles (mientras la IA procesa). */
  procesando?: boolean;
}

export default function CapturaImagen({
  onCaptura,
  etiquetaAccion = "Analizar imagen",
  procesando = false,
}: CapturaImagenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [camaraActiva, setCamaraActiva] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const detenerCamara = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCamaraActiva(false);
  }, []);

  // Limpieza al desmontar: nunca dejar la cámara encendida.
  useEffect(() => detenerCamara, [detenerCamara]);

  const iniciarCamara = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setPreview(null);
      setCamaraActiva(true);
      // Esperar al render del <video> antes de asignar el stream.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      });
    } catch (e) {
      console.error(e);
      toast.error(
        "No se pudo acceder a la cámara. Usá la opción de subir archivo."
      );
    }
  };

  const capturarDeCamara = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPreview(dataUrl);
    detenerCamara();
  };

  const onArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      detenerCamara();
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    // Permitir volver a elegir el mismo archivo.
    e.target.value = "";
  };

  const reiniciar = () => {
    setPreview(null);
    detenerCamara();
  };

  const confirmar = () => {
    if (preview) onCaptura(preview);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      {/* Zona de vista */}
      <div className="rounded-lg overflow-hidden bg-gray-900 aspect-video flex items-center justify-center mb-4">
        {preview ? (
          <img src={preview} alt="Vista previa" className="max-h-full max-w-full object-contain" />
        ) : camaraActiva ? (
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        ) : (
          <div className="text-gray-400 text-sm flex flex-col items-center gap-2">
            <Camera className="h-8 w-8" />
            <span>Iniciá la cámara o subí una foto</span>
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="flex flex-wrap gap-2">
        {!preview && !camaraActiva && (
          <>
            <Button variant="outline" onClick={iniciarCamara} disabled={procesando} className="rounded-xl">
              <Camera className="w-4 h-4 mr-2" /> Usar cámara
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={procesando} className="rounded-xl">
              <Upload className="w-4 h-4 mr-2" /> Subir archivo
            </Button>
          </>
        )}

        {camaraActiva && (
          <>
            <Button onClick={capturarDeCamara} disabled={procesando} className="rounded-xl">
              <Camera className="w-4 h-4 mr-2" /> Capturar
            </Button>
            <Button variant="ghost" onClick={detenerCamara} disabled={procesando} className="rounded-xl">
              <X className="w-4 h-4 mr-2" /> Cancelar
            </Button>
          </>
        )}

        {preview && (
          <>
            <Button onClick={confirmar} disabled={procesando} className="rounded-xl">
              {procesando ? "Procesando..." : etiquetaAccion}
            </Button>
            <Button variant="ghost" onClick={reiniciar} disabled={procesando} className="rounded-xl">
              <RefreshCw className="w-4 h-4 mr-2" /> Reintentar
            </Button>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onArchivo}
      />
    </div>
  );
}
