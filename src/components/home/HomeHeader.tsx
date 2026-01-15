import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, HelpCircle, LogOut, Settings, ChevronDown, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AdminNotificationCenter } from '@/components/AdminNotificationCenter';
import logoImex from '@/assets/logo-imex.png';

interface HomeHeaderProps {
  userName: string;
  userEmail: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  onLogout: () => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  userName,
  userEmail,
  isAdmin,
  isSuperAdmin,
  onLogout,
}) => {
  const navigate = useNavigate();
  
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src={logoImex} alt="IMEX" className="h-8" />
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1">
          {/* Notifications - Admin only */}
          {isAdmin && <AdminNotificationCenter />}

          {/* Help */}
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
            <HelpCircle className="h-5 w-5" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 gap-2 px-2">
                <Avatar className="h-7 w-7 border border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-xs text-primary font-medium">
                    {getInitials(userName)}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover border border-border shadow-lg">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">{userEmail}</p>
                {isSuperAdmin && (
                  <span className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Super Admin
                  </span>
                )}
              </div>
              <DropdownMenuSeparator />
              {isAdmin && (
                <>
                  <DropdownMenuItem onClick={() => navigate('/fabricantes')} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Configurações
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
