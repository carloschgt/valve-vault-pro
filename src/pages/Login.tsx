import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import logoImex from '@/assets/logo-imex.png';

type Step = 'login' | 'set-password';

const Login = () => {
  const navigate = useNavigate();
  const { login, setPassword } = useAuth();
  
  const [step, setStep] = useState<Step>('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error('Digite seu email');
      return;
    }

    setIsLoading(true);
    const result = await login(email.trim(), senha);
    setIsLoading(false);

    if (result.success) {
      toast.success('Login realizado com sucesso!');
      navigate('/');
    } else if (result.needsPassword) {
      setStep('set-password');
      setSenha('');
      toast.info('Primeiro acesso! Configure sua senha.');
    } else {
      toast.error(result.error || 'Erro ao fazer login');
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (senha.length !== 6 || !/^\d+$/.test(senha)) {
      toast.error('A senha deve ter exatamente 6 dígitos numéricos');
      return;
    }

    if (senha !== confirmSenha) {
      toast.error('As senhas não conferem');
      return;
    }

    setIsLoading(true);
    const result = await setPassword(email.trim(), senha);
    setIsLoading(false);

    if (result.success) {
      toast.success('Senha definida com sucesso!');
      navigate('/');
    } else {
      toast.error(result.error || 'Erro ao definir senha');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-primary/5 p-4">
      <Card className="w-full max-w-sm shadow-2xl border-primary/20">
        <CardHeader className="space-y-4 text-center pb-2">
          <div className="mx-auto">
            <img 
              src={logoImex} 
              alt="IMEX Solutions" 
              className="h-20 w-auto object-contain"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {step === 'login' ? 'Bem-vindo!' : 'Primeiro Acesso'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {step === 'login' 
                ? 'Entre com suas credenciais' 
                : 'Configure sua senha de 6 dígitos'}
            </p>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {step === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu.email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    maxLength={6}
                    inputMode="numeric"
                    pattern="\d{6}"
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-senha">Nova Senha (6 dígitos)</Label>
                <div className="relative">
                  <Input
                    id="new-senha"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    inputMode="numeric"
                    pattern="\d{6}"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-senha">Confirmar Senha</Label>
                <Input
                  id="confirm-senha"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••"
                  value={confirmSenha}
                  onChange={(e) => setConfirmSenha(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  inputMode="numeric"
                  pattern="\d{6}"
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Definir Senha'
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep('login');
                  setSenha('');
                  setConfirmSenha('');
                }}
                disabled={isLoading}
              >
                Voltar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
