import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { StockService } from "@/services/StockServices";
import { insumoService } from "@/services/insumoServices";

export default function StockForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const location = useLocation();

    const isEditing = Boolean(id);
    const isAjuste = location.pathname.includes("/ajuste");

    const [loading, setLoading] = useState(false);
    const [insumos, setInsumos] = useState<any[]>([]);
    
    // Guardaremos el stock_id si estamos en modo ajuste
    const [selectedStockId, setSelectedStockId] = useState<number | null>(null);

    const [form, setForm] = useState({
        insumo_id: "",
        cantidad: "",
        stock_min: "",
        stock_max: "",
    });

    useEffect(() => {
        if (isAjuste) {
            // En modo Ajuste Manual, queremos listar solo insumos que YA tienen stock
            StockService.getAll()
                .then((stocks) => {
                    // Mapeamos usando el stock_id para evitar errores de claves duplicadas en Radix UI
                    const insumosConStock = stocks.map((s: any) => ({
                        id: s.id, // ID único del stock (soluciona error de duplicados)
                        insumo_id: s.insumo_id, // ID real del insumo
                        nombre: `${s.insumo?.nombre || "Insumo desconocido"} (Stock #${s.id})`,
                        stock_id: s.id,
                        cantidad: s.cantidad,
                        stock_min: s.stock_min,
                        stock_max: s.stock_max
                    }));
                    setInsumos(insumosConStock);
                })
                .catch(() => {
                    toast.error("Error al cargar los stocks existentes");
                });
        } else {
            // En modo Nuevo Stock, cargamos los insumos normales
            insumoService.getAll()
                .then((data) => {
                    // Mapeo estándar para insumos (id = insumo_id)
                    setInsumos(data.map((i: any) => ({
                        id: i.id,
                        insumo_id: i.id,
                        nombre: i.nombre
                    })));
                })
                .catch(() => {
                    toast.error("Error al cargar insumos");
                });
        }

        if (isEditing && id) {
            StockService.getById(Number(id))
                .then((data) => {
                    setForm({
                        insumo_id: data.insumo_id?.toString() || "",
                        cantidad: data.cantidad?.toString() || "",
                        stock_min: data.stock_min?.toString() || "",
                        stock_max: data.stock_max?.toString() || "",
                    });
                })
                .catch(() => {
                    toast.error("Error al cargar stock");
                });
        }
    }, [id, isEditing, isAjuste]);

    const handleChange = (field: string, value: string) => {
        if (field === "insumo_id" && isAjuste) {
            // Si estamos en ajuste y seleccionamos un stock (cuyo value es el stock.id),
            // autocompletamos las cantidades actuales
            const selectedInfo = insumos.find((i) => i.id.toString() === value);
            if (selectedInfo) {
                setSelectedStockId(selectedInfo.stock_id);
                setForm({
                    insumo_id: selectedInfo.insumo_id.toString(), // Guardamos el insumo_id real para el payload
                    cantidad: selectedInfo.cantidad?.toString() || "",
                    stock_min: selectedInfo.stock_min?.toString() || "",
                    stock_max: selectedInfo.stock_max?.toString() || "",
                });
                return;
            }
        } else if (field === "insumo_id" && !isAjuste) {
             setForm((prev) => ({
                 ...prev,
                 insumo_id: value,
             }));
             return;
        }

        setForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload: any = {
                insumo_id: Number(form.insumo_id),
                cantidad: Number(form.cantidad),
                stock_min: Number(form.stock_min),
                stock_max: Number(form.stock_max),
            };

            // VALIDACIONES
            if (payload.cantidad < 0) {
                toast.error("La cantidad no puede ser negativa");
                setLoading(false);
                return;
            }

            if (payload.stock_min > payload.stock_max) {
                toast.error("El stock mínimo no puede ser mayor al máximo");
                setLoading(false);
                return;
            }

            if (isEditing && id) {
                await StockService.update(Number(id), payload);
                toast.success("Stock actualizado correctamente");
            } else if (isAjuste && selectedStockId) {
                await StockService.update(selectedStockId, payload);
                toast.success("Ajuste manual realizado correctamente");
            } else {
                await StockService.create(payload);
                toast.success("Stock creado correctamente");
            }

            navigate("/stock");
        } catch (err: any) {
            toast.error(err.message || "Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-soft">
            <AppHeader />

            <main className="container px-4 py-6 md:py-8 max-w-2xl">
                {/* BOTÓN VOLVER */}
                <Button
                    variant="ghost"
                    onClick={() => navigate("/stock")}
                    className="mb-6 w-full sm:w-auto"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                </Button>

                {/* HEADER */}
                <div className="flex items-start md:items-center gap-3 mb-8">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center">
                        <PlusCircle className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">
                            {isEditing
                                ? "Editar Stock"
                                : isAjuste 
                                    ? "Ajuste Manual de Stock" 
                                    : "Nuevo Stock"}
                        </h1>
                        <p className="text-muted-foreground">
                            Registro de existencias
                        </p>
                    </div>
                </div>

                {/* FORMULARIO */}
                <form
                    onSubmit={handleSubmit}
                    className="bg-card rounded-3xl shadow-card p-4 md:p-8 space-y-6"
                >
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg border-b pb-2">
                            Datos del Stock
                        </h3>

                        {/* INSUMO */}
                        <div className="space-y-2">
                            <Label>
                                {isAjuste ? "Seleccione un Stock *" : "Insumo *"}
                            </Label>
                            <Select
                                value={isAjuste ? (selectedStockId?.toString() || undefined) : (form.insumo_id || undefined)}
                                onValueChange={(value) => handleChange("insumo_id", value)}
                                disabled={isEditing}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder={isAjuste ? "Seleccione stock a ajustar" : "Seleccionar insumo"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {insumos.map((insumo) => (
                                        <SelectItem
                                            key={insumo.id}
                                            value={insumo.id.toString()}
                                        >
                                            {insumo.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* CANTIDAD */}
                        <div className="space-y-2">
                            <Label htmlFor="cantidad">Cantidad *</Label>
                            <Input
                                id="cantidad"
                                type="number"
                                required
                                disabled={loading}
                                value={form.cantidad}
                                onChange={(e) => handleChange("cantidad", e.target.value)}
                                placeholder="Ej: 50"
                            />
                        </div>

                        {/* STOCK MIN MAX */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="stock_min">Stock mínimo *</Label>
                                <Input
                                    id="stock_min"
                                    type="number"
                                    required
                                    disabled={loading}
                                    value={form.stock_min}
                                    onChange={(e) => handleChange("stock_min", e.target.value)}
                                    placeholder="Ej: 10"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="stock_max">Stock máximo *</Label>
                                <Input
                                    id="stock_max"
                                    type="number"
                                    required
                                    disabled={loading}
                                    value={form.stock_max}
                                    onChange={(e) => handleChange("stock_max", e.target.value)}
                                    placeholder="Ej: 100"
                                />
                            </div>
                        </div>
                    </div>

                    {/* BOTÓN */}
                    <Button
                        type="submit"
                        size="lg"
                        disabled={loading || !form.insumo_id || (isAjuste && !selectedStockId)}
                        className="w-full text-base md:text-lg font-semibold shadow-soft"
                    >
                        {loading
                            ? "Guardando..."
                            : isEditing
                                ? "Guardar Cambios"
                                : isAjuste
                                    ? "Guardar Ajuste"
                                    : "Crear Stock"}
                    </Button>
                </form>
            </main>
        </div>
    );
}