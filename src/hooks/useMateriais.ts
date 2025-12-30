import { useState, useEffect } from 'react';
import type { Material, Movimentacao } from '@/types/material';

const STORAGE_KEY = 'mrx_materiais';
const MOVIMENTACOES_KEY = 'mrx_movimentacoes';

export function useMateriais() {
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedMov = localStorage.getItem(MOVIMENTACOES_KEY);
    
    if (stored) {
      setMateriais(JSON.parse(stored));
    }
    if (storedMov) {
      setMovimentacoes(JSON.parse(storedMov));
    }
    setIsLoading(false);
  }, []);

  const saveMateriais = (newMateriais: Material[]) => {
    setMateriais(newMateriais);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newMateriais));
  };

  const saveMovimentacoes = (newMovimentacoes: Movimentacao[]) => {
    setMovimentacoes(newMovimentacoes);
    localStorage.setItem(MOVIMENTACOES_KEY, JSON.stringify(newMovimentacoes));
  };

  const addMaterial = (material: Omit<Material, 'id' | 'dataUltimaMovimentacao'>) => {
    const newMaterial: Material = {
      ...material,
      id: crypto.randomUUID(),
      dataUltimaMovimentacao: new Date().toISOString(),
    };
    saveMateriais([...materiais, newMaterial]);
    
    // Registrar movimentação de entrada
    const movimentacao: Movimentacao = {
      id: crypto.randomUUID(),
      materialId: newMaterial.id,
      tipo: 'entrada',
      quantidade: material.quantidade,
      data: new Date().toISOString(),
      destino: material.localizacao,
      responsavel: material.responsavel || 'Sistema',
      observacoes: 'Cadastro inicial do material',
    };
    saveMovimentacoes([...movimentacoes, movimentacao]);
    
    return newMaterial;
  };

  const updateMaterial = (id: string, updates: Partial<Material>) => {
    const newMateriais = materiais.map((m) =>
      m.id === id ? { ...m, ...updates, dataUltimaMovimentacao: new Date().toISOString() } : m
    );
    saveMateriais(newMateriais);
  };

  const deleteMaterial = (id: string) => {
    saveMateriais(materiais.filter((m) => m.id !== id));
  };

  const addMovimentacao = (movimentacao: Omit<Movimentacao, 'id'>) => {
    const newMovimentacao: Movimentacao = {
      ...movimentacao,
      id: crypto.randomUUID(),
    };
    saveMovimentacoes([...movimentacoes, newMovimentacao]);

    // Atualizar quantidade do material
    const material = materiais.find((m) => m.id === movimentacao.materialId);
    if (material) {
      let novaQuantidade = material.quantidade;
      if (movimentacao.tipo === 'entrada') {
        novaQuantidade += movimentacao.quantidade;
      } else if (movimentacao.tipo === 'saida') {
        novaQuantidade -= movimentacao.quantidade;
      }
      updateMaterial(material.id, {
        quantidade: Math.max(0, novaQuantidade),
        localizacao: movimentacao.destino || material.localizacao,
      });
    }

    return newMovimentacao;
  };

  const getMaterialById = (id: string) => materiais.find((m) => m.id === id);

  const getMovimentacoesByMaterial = (materialId: string) =>
    movimentacoes.filter((m) => m.materialId === materialId);

  return {
    materiais,
    movimentacoes,
    isLoading,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    addMovimentacao,
    getMaterialById,
    getMovimentacoesByMaterial,
  };
}
