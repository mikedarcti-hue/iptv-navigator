import { Heart } from "lucide-react";

const FavoritesView = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Favoritos</h1>
        <p className="text-sm text-muted-foreground mt-1">Seus canais e títulos favoritos</p>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 rounded-2xl bg-surface flex items-center justify-center mb-6 card-shadow">
          <Heart className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum favorito ainda</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Toque no ícone de coração em qualquer filme ou série para adicioná-lo aqui.
        </p>
      </div>
    </div>
  );
};

export default FavoritesView;
