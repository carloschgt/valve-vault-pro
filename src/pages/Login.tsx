import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Loader2, Eye, EyeOff, ArrowRight, ArrowLeft, UserPlus, Check, X, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import logoImex from '@/assets/logo-imex.png';

type Step = 'email' | 'login' | 'register' | 'resetPassword';

// Password validation
function validatePassword(senha: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (senha.length < 8) {
    errors.push('Mínimo 8 caracteres');
  }
  if (!/[a-zA-Z]/.test(senha)) {
    errors.push('Pelo menos uma letra');
  }
  if (!/\d/.test(senha)) {
    errors.push('Pelo menos um número');
  }
  
  return { valid: errors.length === 0, errors };
}

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

  const passwordValidation = validatePassword(senha);

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
    
    if (!passwordValidation.valid) {
      toast.error('Senha inválida');
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

    if (!passwordValidation.valid) {
      toast.error('A senha não atende aos requisitos');
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordValidation.valid) {
      toast.error('A senha não atende aos requisitos');
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('auth', {
        body: { action: 'resetPassword', email: email.trim(), senha },
      });

      if (error) {
        console.error('Reset password error:', error);
        toast.error('Erro ao redefinir senha');
        setIsLoading(false);
        return;
      }

      if (!data.success) {
        toast.error(data.error || 'Erro ao redefinir senha');
        setIsLoading(false);
        return;
      }

      toast.success(data.message);
      
      // Reset form
      setStep('email');
      setSenha('');
      
      // If admin, they can login immediately
      if (!data.requiresApproval) {
        setStep('login');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      toast.error('Erro ao redefinir senha');
    }
    
    setIsLoading(false);
  };

  const goBack = () => {
    setStep('email');
    setSenha('');
  };

  const goToResetPassword = () => {
    setSenha('');
    setStep('resetPassword');
  };

  const PasswordRequirement = ({ met, text }: { met: boolean; text: string }) => (
    <div className={`flex items-center gap-1.5 text-xs ${met ? 'text-green-600' : 'text-muted-foreground'}`}>
      {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      <span>{text}</span>
    </div>
  );

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
            {step === 'resetPassword' && (
              <>
                <h1 className="text-xl font-bold text-foreground">Redefinir Senha</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie uma nova senha para sua conta
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
                <Label htmlFor="senha">Senha</Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digite sua senha"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="pr-10"
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

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={goBack} disabled={isLoading}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button type="submit" className="flex-1" disabled={isLoading || !senha}>
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

              <button
                type="button"
                onClick={goToResetPassword}
                className="w-full text-sm text-primary hover:underline pt-2"
              >
                Esqueci minha senha
              </button>
            </form>
          )}

          {/* Step: Reset Password */}
          {step === 'resetPassword' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Redefinindo senha para:
                </p>
                <p className="text-sm font-medium">{email}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="novaSenhaReset">Nova Senha</Label>
                <div className="relative">
                  <Input
                    id="novaSenhaReset"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    autoComplete="new-password"
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                
                {/* Password requirements */}
                <div className="space-y-1 pt-1">
                  <PasswordRequirement 
                    met={senha.length >= 8} 
                    text="Mínimo 8 caracteres" 
                  />
                  <PasswordRequirement 
                    met={/[a-zA-Z]/.test(senha)} 
                    text="Pelo menos uma letra" 
                  />
                  <PasswordRequirement 
                    met={/\d/.test(senha)} 
                    text="Pelo menos um número" 
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={goBack} disabled={isLoading}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1" 
                  disabled={isLoading || !passwordValidation.valid}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redefinindo...
                    </>
                  ) : (
                    <>
                      <KeyRound className="mr-2 h-4 w-4" />
                      Redefinir Senha
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center pt-2">
                Usuários comuns precisarão de aprovação do admin após redefinir a senha.
              </p>
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
                <Label htmlFor="novaSenha">Crie sua senha</Label>
                <div className="relative">
                  <Input
                    id="novaSenha"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    autoComplete="new-password"
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                
                {/* Password requirements */}
                <div className="space-y-1 pt-1">
                  <PasswordRequirement 
                    met={senha.length >= 8} 
                    text="Mínimo 8 caracteres" 
                  />
                  <PasswordRequirement 
                    met={/[a-zA-Z]/.test(senha)} 
                    text="Pelo menos uma letra" 
                  />
                  <PasswordRequirement 
                    met={/\d/.test(senha)} 
                    text="Pelo menos um número" 
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={goBack} disabled={isLoading}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1" 
                  disabled={isLoading || !passwordValidation.valid || !nome.trim()}
                >
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
