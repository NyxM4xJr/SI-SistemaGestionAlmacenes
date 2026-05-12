import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Input } from "@/components/ui/input";
import { StockService, Stock } from "@/services/StockServices";
import { Pencil, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function StockList() {

    const [productos, setProductos] = useState<Stock[]>([]);
    const [search, setSearch] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        cargarStock();
    }, []);

    const cargarStock = async () => {
        try {
        const data = await StockService.getAll();
        setProductos(data);
        } catch (error) {
        console.error(error);
        }
    };

    const filtered = productos.filter((p) =>
        p.insumo_id.toString().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-gradient-soft">
        <AppHeader />

        <main className="container px-4 py-6 md:py-8 max-w-7xl">

            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div>
                <h1 className="text-2xl md:text-3xl font-bold">
                    Gestión de Stock
                </h1>

                <p className="text-muted-foreground">
                    Control de inventario y existencias
                </p>
            </div>

            <div className="flex w-full md:w-auto">

                <button
                    onClick={() => navigate("/stock/nuevo")}
                    className="w-full md:w-auto bg-green-600 border border-black/100 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-green-700 transition shadow-sm"
                >
                    <Plus size={18} />
                    Nuevo Stock
                </button>

            </div>

</div>

            <Input
            placeholder="Buscar por ID de insumo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4"
            />

            <div className="bg-card rounded-3xl shadow-card overflow-x-auto">

            <table className="w-full min-w-[800px]">

                <thead>
                <tr className="border-b bg-secondary/50">

                    <th className="p-4 text-left">
                    Insumo
                    </th>

                    <th className="p-4 text-left">
                    Cantidad
                    </th>

                    <th className="p-4 text-left">
                    Stock mínimo
                    </th>

                    <th className="p-4 text-left">
                    Stock maximo
                    </th>

                    <th className="p-4 text-left">
                    Estado
                    </th>

                    <th className="p-4 text-left">
                    Acciones
                    </th>

                </tr>
                </thead>

                <tbody>

                {filtered.map((producto) => (

                    <tr
                    key={producto.id}
                    className="border-b"
                    >

                    <td className="p-4 font-medium">
                        {producto.insumo?.nombre}
                    </td>

                    <td className="p-4">
                        {producto.cantidad}
                    </td>

                    <td className="p-4">
                        {producto.stock_min}
                    </td>
                    
                    <td className="p-4">
                    {producto.stock_max}
                    </td> 
                    
                    <td className="p-4">

                        {producto.cantidad === 0 ? (

                        <span className="text-red-500 font-bold">
                            Agotado
                        </span>

                        ) : producto.cantidad <= producto.stock_min ? (

                        <span className="text-yellow-500 font-bold">
                            Bajo
                        </span>

                        ) : (

                        <span className="text-green-600 font-bold">
                            Disponible
                        </span>

                        )}

                    </td>

                    <td className="p-4 w-[120px]">

                        <div className="flex items-center justify-start gap-3">
                        

                            <button
                                onClick={() => navigate(`/stock/editar/${producto.id}`)}
                                className="text-blue-600 hover:text-blue-800 transition"
                            >
                                <Pencil size={18} />
                            </button>

                        </div>

                    </td>

                    </tr>

                ))}

                </tbody>

            </table>

            </div>

        </main>
        </div>
    );
}