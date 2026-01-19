import { useState } from 'react';
import { Calculator, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CalculadoraModalProps {
  open: boolean;
  onClose: () => void;
  onUseResult: (result: number) => void;
}

export function CalculadoraModal({ open, onClose, onUseResult }: CalculadoraModalProps) {
  const [caixas, setCaixas] = useState('');
  const [unidadesPorCaixa, setUnidadesPorCaixa] = useState('');
  const [paletes, setPaletes] = useState('');
  const [unidadesPorPalete, setUnidadesPorPalete] = useState('');
  const [unidadesSoltas, setUnidadesSoltas] = useState('');
  const [expressao, setExpressao] = useState('');

  const calcularTotal = (): number => {
    const totalCaixas = (parseFloat(caixas) || 0) * (parseFloat(unidadesPorCaixa) || 0);
    const totalPaletes = (parseFloat(paletes) || 0) * (parseFloat(unidadesPorPalete) || 0);
    const totalSoltas = parseFloat(unidadesSoltas) || 0;
    return totalCaixas + totalPaletes + totalSoltas;
  };

  // Safe math expression parser without using Function() or eval()
  const calcularExpressao = (): number => {
    try {
      const expr = expressao.trim();
      if (!expr) return 0;
      
      // Validate: only numbers, operators, parentheses, decimal points
      if (!/^[0-9+\-*/().]+$/.test(expr)) {
        return 0;
      }
      
      // Validate balanced parentheses
      let parenCount = 0;
      for (const char of expr) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        if (parenCount < 0) return 0; // Closing before opening
      }
      if (parenCount !== 0) return 0; // Unbalanced
      
      // Use safe recursive descent parser
      const result = parseExpression(expr);
      return isNaN(result) || !isFinite(result) ? 0 : Math.round(result);
    } catch {
      return 0;
    }
  };

  // Safe recursive descent parser for mathematical expressions
  const parseExpression = (expr: string): number => {
    let pos = 0;
    
    const parseNumber = (): number => {
      let numStr = '';
      while (pos < expr.length && /[0-9.]/.test(expr[pos])) {
        numStr += expr[pos++];
      }
      return parseFloat(numStr) || 0;
    };
    
    const parseFactor = (): number => {
      if (expr[pos] === '(') {
        pos++; // Skip '('
        const result = parseAddSub();
        pos++; // Skip ')'
        return result;
      }
      if (expr[pos] === '-') {
        pos++;
        return -parseFactor();
      }
      if (expr[pos] === '+') {
        pos++;
        return parseFactor();
      }
      return parseNumber();
    };
    
    const parseMulDiv = (): number => {
      let result = parseFactor();
      while (pos < expr.length && (expr[pos] === '*' || expr[pos] === '/')) {
        const op = expr[pos++];
        const right = parseFactor();
        if (op === '*') result *= right;
        else if (right !== 0) result /= right;
        else return NaN; // Division by zero
      }
      return result;
    };
    
    const parseAddSub = (): number => {
      let result = parseMulDiv();
      while (pos < expr.length && (expr[pos] === '+' || expr[pos] === '-')) {
        const op = expr[pos++];
        const right = parseMulDiv();
        if (op === '+') result += right;
        else result -= right;
      }
      return result;
    };
    
    return parseAddSub();
  };

  const total = calcularTotal();
  const totalExpressao = calcularExpressao();

  const handleUsarResultado = () => {
    const finalResult = total > 0 ? total : totalExpressao;
    if (finalResult > 0) {
      onUseResult(finalResult);
      handleReset();
      onClose();
    }
  };

  const handleReset = () => {
    setCaixas('');
    setUnidadesPorCaixa('');
    setPaletes('');
    setUnidadesPorPalete('');
    setUnidadesSoltas('');
    setExpressao('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Calculadora de Quantidade
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Caixas */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Qtd Caixas</Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={caixas}
                onChange={(e) => setCaixas(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Un/Caixa</Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={unidadesPorCaixa}
                onChange={(e) => setUnidadesPorCaixa(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {/* Paletes */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Qtd Paletes</Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={paletes}
                onChange={(e) => setPaletes(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Un/Palete</Label>
              <Input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={unidadesPorPalete}
                onChange={(e) => setUnidadesPorPalete(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {/* Unidades soltas */}
          <div>
            <Label className="text-xs">Unidades Soltas</Label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={unidadesSoltas}
              onChange={(e) => setUnidadesSoltas(e.target.value)}
              className="h-9"
            />
          </div>

          {total > 0 && (
            <div className="rounded-lg bg-primary/10 p-3 text-center">
              <p className="text-sm text-muted-foreground">Total calculado</p>
              <p className="text-3xl font-bold text-primary">{total}</p>
            </div>
          )}

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-border"></div>
            <span className="mx-4 flex-shrink text-xs text-muted-foreground">ou digite expressão</span>
            <div className="flex-grow border-t border-border"></div>
          </div>

          {/* Expressão matemática */}
          <div>
            <Label className="text-xs">Expressão (ex: 10*12+5)</Label>
            <Input
              type="text"
              placeholder="Ex: 1012+348 ou 10*12+5"
              value={expressao}
              onChange={(e) => setExpressao(e.target.value)}
              className="h-9 font-mono"
            />
            {expressao && totalExpressao > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                Resultado: <span className="font-bold text-primary">{totalExpressao}</span>
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Limpar
            </Button>
            <Button 
              onClick={handleUsarResultado} 
              className="flex-1"
              disabled={total === 0 && totalExpressao === 0}
            >
              Usar Resultado
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
