import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SheetData {
  values: string[][];
}

const AUTH_KEY = 'imex_auth_user';

function getSessionToken(): string | null {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      const user = JSON.parse(stored);
      return user.sessionToken || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export function useGoogleSheets() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSheets = async (): Promise<string[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const sessionToken = getSessionToken();
      const { data, error: fnError } = await supabase.functions.invoke('google-sheets', {
        body: { action: 'getSheets' },
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
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
      const sessionToken = getSessionToken();
      const { data, error: fnError } = await supabase.functions.invoke('google-sheets', {
        body: { action: 'getData', sheetName, range },
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
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

  const appendData = async (sheetName: string, values: string[][]): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const sessionToken = getSessionToken();
      const { data, error: fnError } = await supabase.functions.invoke('google-sheets', {
        body: { action: 'appendData', sheetName, values },
        headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);
      
      return true;
    } catch (err: any) {
      console.error('Error appending to sheet:', err);
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const getProductByCode = async (code: string, productSheetName: string = 'Bdados'): Promise<{ descricao: string } | null> => {
    const data = await getData(productSheetName);
    
    if (data.length === 0) return null;

    // Assume first row is header, find column indexes
    const headers = data[0].map(h => h.toLowerCase().trim());
    // Look for code column: "item", "codigo", "código", "code"
    const codeIndex = headers.findIndex(h => h === 'item' || h.includes('codigo') || h.includes('código') || h.includes('code'));
    // Look for description column: prioritize exact "descrição" or "descricao" (column C), not "descrição imex"
    const descIndex = headers.findIndex(h => h === 'descrição' || h === 'descricao' || h === 'description');

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
    appendData,
    getProductByCode,
    isLoading,
    error,
  };
}
