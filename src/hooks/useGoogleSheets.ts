import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SheetData {
  values: string[][];
}

export function useGoogleSheets() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSheets = async (): Promise<string[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('google-sheets', {
        body: { action: 'getSheets' },
      });

      if (fnError) throw fnError;
      return data.sheets || [];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const getData = async (sheetName: string, range?: string): Promise<string[][]> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('google-sheets', {
        body: { action: 'getData', sheetName, range },
      });

      if (fnError) throw fnError;
      return data.values || [];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const getProductByCode = async (code: string, productSheetName: string = 'Base de Produtos'): Promise<{ descricao: string } | null> => {
    const data = await getData(productSheetName);
    
    if (data.length === 0) return null;

    // Assume first row is header, find column indexes
    const headers = data[0].map(h => h.toLowerCase().trim());
    const codeIndex = headers.findIndex(h => h.includes('codigo') || h.includes('código') || h.includes('code'));
    const descIndex = headers.findIndex(h => h.includes('descricao') || h.includes('descrição') || h.includes('description'));

    if (codeIndex === -1 || descIndex === -1) return null;

    // Search for the product
    for (let i = 1; i < data.length; i++) {
      if (data[i][codeIndex]?.trim().toLowerCase() === code.trim().toLowerCase()) {
        return { descricao: data[i][descIndex] || '' };
      }
    }

    return null;
  };

  return {
    getSheets,
    getData,
    getProductByCode,
    isLoading,
    error,
  };
}
