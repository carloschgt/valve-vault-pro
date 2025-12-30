import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Package, ArrowRightLeft, BarChart3, Settings, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo-mrx.png';

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  showAddButton?: boolean;
  onAddClick?: () => void;
}

const navItems = [
  { path: '/', icon: Package, label: 'Estoque' },
  { path: '/movimentacoes', icon: ArrowRightLeft, label: 'Movimentações' },
  { path: '/relatorios', icon: BarChart3, label: 'Relatórios' },
  { path: '/configuracoes', icon: Settings, label: 'Config' },
];

export function MobileLayout({ children, title, showAddButton, onAddClick }: MobileLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background safe-area-inset">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="MRX Solutions" className="h-9 w-auto" />
          </div>
          {title && (
            <h1 className="font-display text-lg font-semibold text-foreground">{title}</h1>
          )}
          {showAddButton && (
            <button
              onClick={onAddClick}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-md transition-all hover:shadow-glow active:scale-95"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
          {!showAddButton && <div className="w-10" />}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm">
        <div className="flex h-16 items-center justify-around px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl px-4 py-2 transition-all duration-200',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                    isActive && 'bg-accent'
                  )}
                >
                  <Icon className={cn('h-5 w-5', isActive && 'text-primary')} />
                </div>
                <span className={cn('text-xs font-medium', isActive && 'text-primary')}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
