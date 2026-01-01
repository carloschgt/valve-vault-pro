import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Helper functions for base64url encoding/decoding
function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const binaryString = atob(base64 + padding);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Dispositivo';
}

export function useWebAuthn() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if WebAuthn is supported
  const isSupported = (): boolean => {
    return !!(window.PublicKeyCredential && 
      typeof window.PublicKeyCredential === 'function');
  };

  // Check if user has biometric credentials
  const checkBiometric = async (email: string): Promise<{ hasBiometric: boolean; devices: string[] }> => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('auth', {
        body: { action: 'checkBiometric', email },
      });

      if (fnError) throw fnError;
      
      return {
        hasBiometric: data?.hasBiometric || false,
        devices: data?.devices || [],
      };
    } catch (err) {
      console.error('Check biometric error:', err);
      return { hasBiometric: false, devices: [] };
    }
  };

  // Register biometric credential
  const registerBiometric = async (sessionToken: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupported()) {
      return { success: false, error: 'Biometria não suportada neste dispositivo' };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get challenge from server
      const { data: startData, error: startError } = await supabase.functions.invoke('auth', {
        body: { action: 'biometricRegisterStart', sessionToken },
      });

      if (startError || !startData?.success) {
        throw new Error(startData?.error || 'Erro ao iniciar registro');
      }

      const { challenge, userId, userName, userEmail } = startData;

      // Create credentials
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: base64urlToBuffer(challenge),
          rp: {
            name: 'IMEX Estoque',
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(userId),
            name: userEmail,
            displayName: userName,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },   // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'none',
        },
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Falha ao criar credencial');
      }

      const attestationResponse = credential.response as AuthenticatorAttestationResponse;
      const credentialId = bufferToBase64url(credential.rawId);
      const publicKey = bufferToBase64url(attestationResponse.getPublicKey()!);

      // Complete registration on server
      const { data: completeData, error: completeError } = await supabase.functions.invoke('auth', {
        body: {
          action: 'biometricRegisterComplete',
          sessionToken,
          credentialId,
          publicKey,
          deviceName: getDeviceName(),
        },
      });

      if (completeError || !completeData?.success) {
        throw new Error(completeData?.error || 'Erro ao finalizar registro');
      }

      return { success: true };
    } catch (err: any) {
      console.error('Register biometric error:', err);
      const errorMessage = err.name === 'NotAllowedError' 
        ? 'Biometria cancelada ou não permitida'
        : err.message || 'Erro ao cadastrar biometria';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  // Login with biometric
  const loginWithBiometric = async (
    email: string,
    deviceInfo?: string
  ): Promise<{ 
    success: boolean; 
    error?: string; 
    user?: { id: string; nome: string; email: string; tipo: string };
    sessionToken?: string;
  }> => {
    if (!isSupported()) {
      return { success: false, error: 'Biometria não suportada neste dispositivo' };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get challenge and credential IDs from server
      const { data: startData, error: startError } = await supabase.functions.invoke('auth', {
        body: { action: 'biometricLoginStart', email },
      });

      if (startError || !startData?.success) {
        throw new Error(startData?.error || 'Erro ao iniciar autenticação');
      }

      const { challenge, credentialIds } = startData;

      // Get credential
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: base64urlToBuffer(challenge),
          rpId: window.location.hostname,
          allowCredentials: credentialIds.map((id: string) => ({
            id: base64urlToBuffer(id),
            type: 'public-key' as const,
            transports: ['internal' as const],
          })),
          userVerification: 'required',
          timeout: 60000,
        },
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Falha na autenticação');
      }

      const credentialId = bufferToBase64url(credential.rawId);

      // Complete login on server
      const { data: completeData, error: completeError } = await supabase.functions.invoke('auth', {
        body: {
          action: 'biometricLoginComplete',
          email,
          credentialId,
          deviceInfo,
        },
      });

      if (completeError || !completeData?.success) {
        throw new Error(completeData?.error || 'Erro ao finalizar login');
      }

      return {
        success: true,
        user: completeData.user,
        sessionToken: completeData.sessionToken,
      };
    } catch (err: any) {
      console.error('Biometric login error:', err);
      const errorMessage = err.name === 'NotAllowedError'
        ? 'Biometria cancelada ou não permitida'
        : err.message || 'Erro na autenticação biométrica';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSupported,
    isLoading,
    error,
    checkBiometric,
    registerBiometric,
    loginWithBiometric,
  };
}
