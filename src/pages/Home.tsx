import { useNavigate } from 'react-router-dom';
import { MapPin, ClipboardList } from 'lucide-react';
import logoImex from '@/assets/logo-imex.png';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-center border-b border-border bg-card p-6">
        <img src={logoImex} alt="IMEX Solutions" className="h-12" />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        <h1 className="text-center text-2xl font-bold text-foreground">
          Selecione a operação
        </h1>
        
        <div className="flex w-full max-w-md flex-col gap-4">
          {/* Endereçamento Button */}
          <button
            onClick={() => navigate('/enderecamento')}
            className="flex flex-col items-center gap-4 rounded-2xl border-2 border-primary bg-primary/5 p-8 transition-all hover:bg-primary/10 hover:shadow-lg active:scale-[0.98]"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primary shadow-md">
              <MapPin className="h-10 w-10 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground">Endereçamento</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cadastrar localização de materiais
              </p>
            </div>
          </button>

          {/* Inventário Button */}
          <button
            onClick={() => navigate('/inventario')}
            className="flex flex-col items-center gap-4 rounded-2xl border-2 border-secondary bg-secondary/5 p-8 transition-all hover:bg-secondary/10 hover:shadow-lg active:scale-[0.98]"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary shadow-md">
              <ClipboardList className="h-10 w-10 text-secondary-foreground" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground">Inventário</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Realizar contagem de materiais
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
