import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Mic, ScanLine } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface HomeSearchBarProps {
  onScanClick: () => void;
}

export const HomeSearchBar: React.FC<HomeSearchBarProps> = ({ onScanClick }) => {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      navigate(`/estoque-atual?search=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="px-4 py-3">
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Código, descrição ou endereço"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="h-11 pl-9 pr-20 rounded-xl border-border bg-muted/50 focus:bg-card"
        />
        <div className="absolute right-1.5 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onScanClick}
            className="h-8 w-8 text-muted-foreground hover:text-primary"
          >
            <ScanLine className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </form>
  );
};
