import { useState, useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ApprovalNotificationProps {
  userId: string;
}

const ApprovalNotification = ({ userId }: ApprovalNotificationProps) => {
  const [show, setShow] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const checkNotification = async () => {
      if (!userId) return;

      try {
        const { data, error } = await supabase.functions.invoke('admin-users', {
          body: { action: 'checkApprovalNotification', userId, adminEmail: user?.email },
        });

        if (!error && data?.showNotification) {
          setShow(true);
        }
      } catch (err) {
        console.error('Error checking notification:', err);
      }
    };

    checkNotification();
  }, [userId, user?.email]);

  const handleDismiss = async () => {
    try {
      await supabase.functions.invoke('admin-users', {
        body: { action: 'dismissApprovalNotification', userId, adminEmail: user?.email },
      });
    } catch (err) {
      console.error('Error dismissing notification:', err);
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 animate-slide-up">
      <div className="mx-auto max-w-lg p-4">
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 shadow-lg">
          <div className="flex-shrink-0">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-green-800">Acesso Liberado!</p>
            <p className="text-sm text-green-700">
              Seu cadastro foi aprovado. Bem-vindo ao sistema!
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="flex-shrink-0 text-green-600 hover:bg-green-100 hover:text-green-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ApprovalNotification;
