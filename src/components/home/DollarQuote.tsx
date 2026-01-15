import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DollarData {
  bid: number;
  ask: number;
  pctChange: number;
  high: number;
  low: number;
  lastUpdate: string;
}

const REFRESH_INTERVAL = 60000; // 1 minuto

export const DollarQuote = () => {
  const [data, setData] = useState<DollarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDollarQuote = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    try {
      const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
      const result = await response.json();
      
      if (result.USDBRL) {
        const usd = result.USDBRL;
        setData({
          bid: parseFloat(usd.bid),
          ask: parseFloat(usd.ask),
          pctChange: parseFloat(usd.pctChange),
          high: parseFloat(usd.high),
          low: parseFloat(usd.low),
          lastUpdate: usd.create_date,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar cotação:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDollarQuote();
    const interval = setInterval(() => fetchDollarQuote(), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const getTrendIcon = () => {
    if (!data) return null;
    if (data.pctChange > 0) return <TrendingUp className="h-3 w-3" />;
    if (data.pctChange < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (!data) return 'text-muted-foreground';
    if (data.pctChange > 0) return 'text-red-500';
    if (data.pctChange < 0) return 'text-green-500';
    return 'text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1.5 animate-pulse">
        <div className="h-4 w-4 rounded-full bg-muted" />
        <div className="h-4 w-16 rounded bg-muted" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <button
      onClick={() => fetchDollarQuote(true)}
      className={cn(
        "flex items-center gap-2 rounded-full bg-gradient-to-r from-green-500/10 to-emerald-500/10",
        "border border-green-500/20 px-3 py-1.5 transition-all duration-300",
        "hover:from-green-500/20 hover:to-emerald-500/20 hover:border-green-500/30",
        "active:scale-95 group"
      )}
    >
      <div className="relative">
        <DollarSign className={cn(
          "h-4 w-4 text-green-600 transition-transform",
          isRefreshing && "animate-spin"
        )} />
        {isRefreshing && (
          <RefreshCw className="absolute inset-0 h-4 w-4 text-green-600 animate-spin" />
        )}
      </div>
      
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-foreground tabular-nums">
          R$ {data.bid.toFixed(2)}
        </span>
        
        <div className={cn("flex items-center gap-0.5 text-xs font-medium", getTrendColor())}>
          {getTrendIcon()}
          <span className="tabular-nums">
            {data.pctChange > 0 ? '+' : ''}{data.pctChange.toFixed(2)}%
          </span>
        </div>
      </div>
      
      <span className="hidden group-hover:inline text-[10px] text-muted-foreground">
        Atualizar
      </span>
    </button>
  );
};
