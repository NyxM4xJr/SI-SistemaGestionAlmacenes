import AppHeader from "@/components/AppHeader";
import { useLocation } from "react-router-dom";
import { Construction } from "lucide-react";

export default function Placeholder() {
  const { pathname } = useLocation();
  const pageName = pathname.replace("/", "").replace(/-/g, " ");

  return (
    <div className="min-h-screen bg-gradient-soft">
      <AppHeader />
      <main className="container py-20 flex flex-col items-center justify-center text-center">
        <Construction className="h-20 w-20 text-muted-foreground mb-6" />
        <h1 className="text-3xl font-bold mb-2">En Construcción</h1>
        <p className="text-lg text-muted-foreground capitalize">
          La sección "{pageName}" estará disponible próximamente
        </p>
      </main>
    </div>
  );
}