import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, MapPin, ClipboardList, Search, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
}

const navItems: NavItem[] = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/enderecamento', icon: MapPin, label: 'Endereçar' },
  { path: '/inventario', icon: ClipboardList, label: 'Inventário' },
  { path: '/estoque-rua', icon: Search, label: 'Consultar' },
  { path: '/menu', icon: MoreHorizontal, label: 'Menu' },
];

interface BottomNavigationProps {
  onMenuClick: () => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (item: NavItem) => {
    if (item.path === '/menu') {
      onMenuClick();
    } else {
      navigate(item.path);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 safe-area-inset">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1.5 transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
