import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, Eye, EyeOff, ArrowRight, ArrowLeft, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import logoImex from '@/assets/logo-imex.png';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

type Step = 'email' | 'login' | 'register';

const Login = () => {
  const navigate = useNavigate();
  const { login, register, checkEmail } = useAuth();
  
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState('');

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error('Digite seu email');
      return;
    }

    // Validate domain client-side for faster feedback
    if (!email.toLowerCase().trim().endsWith('@imexsolutions.com.br')) {
      toast.error('Somente emails @imexsolutions.com.br são permitidos');
      return;
    }

    setIsLoading(true);
    const result = await checkEmail(email.trim());
    setIsLoading(false);

    if (!result.success) {
      toast.error(result.error || 'Erro ao verificar email');
      return;
    }

    if (result.exists) {
      if (!result.approved) {
        toast.warning('Seu cadastro está aguardando aprovação do administrador');
        return;
      }
      setUserName(result.userName || '');
      setStep('login');
    } else {
      // User doesn't exist, go to registration
      setNome(email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
      setStep('register');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (senha.length !== 6) {
      toast.error('Digite os 6 dígitos da senha');
      return;
    }

    setIsLoading(true);
    const result = await login(email.trim(), senha);
    setIsLoading(false);

    if (result.success) {
      toast.success('Login realizado com sucesso!');
      navigate('/');
    } else {
      if (result.pendingApproval) {
        toast.warning(result.error);
      } else {
        toast.error(result.error || 'Erro ao fazer login');
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim()) {
      toast.error('Digite seu nome');
      return;
    }

    if (senha.length !== 6) {
      toast.error('Digite uma senha de 6 dígitos');
      return;
    }

    setIsLoading(true);
    const result = await register(email.trim(), senha, nome.trim());
    setIsLoading(false);

    if (result.success) {
      toast.success('Cadastro realizado! Aguarde aprovação do administrador.');
      setStep('email');
      setEmail('');
      setSenha('');
      setNome('');
    } else {
      toast.error(result.error || 'Erro ao cadastrar');
    }
  };

  const goBack = () => {
    setStep('email');
    setSenha('');
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
            {step === 'email' && (
              <>
                <h1 className="text-xl font-bold text-foreground">Bem-vindo!</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Digite seu email corporativo
                </p>
              </>
            )}
            {step === 'login' && (
              <>
                <h1 className="text-xl font-bold text-foreground">Olá, {userName || 'Usuário'}!</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Digite sua senha para entrar
                </p>
              </>
            )}
            {step === 'register' && (
              <>
                <h1 className="text-xl font-bold text-foreground">Novo Cadastro</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete seu cadastro para acessar
                </p>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {/* Step: Email */}
          {step === 'email' && (
            <form onSubmit={handleCheckEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Corporativo</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu.nome@imexsolutions.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Somente emails @imexsolutions.com.br
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    Continuar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Step: Login */}
          {step === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>Senha (6 dígitos)</Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={senha}
                    onChange={(value) => setSenha(value)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={goBack} disabled={isLoading}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button type="submit" className="flex-1" disabled={isLoading || senha.length !== 6}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* Step: Register */}
          {step === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <Input
                  id="nome"
                  type="text"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoComplete="name"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label>Crie sua senha (6 dígitos)</Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={senha}
                    onChange={(value) => setSenha(value)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Utilize apenas números
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={goBack} disabled={isLoading}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button type="submit" className="flex-1" disabled={isLoading || senha.length !== 6 || !nome.trim()}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Cadastrar
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center pt-2">
                Após o cadastro, um administrador irá aprovar seu acesso.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;