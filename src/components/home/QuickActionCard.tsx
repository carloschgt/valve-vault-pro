import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionCardProps {
  title: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'teal' | 'blue' | 'purple' | 'orange';
  className?: string;
}

const variantStyles = {
  primary: {
    bg: 'bg-primary/10',
    iconBg: 'bg-primary',
    iconColor: 'text-primary-foreground',
    border: 'border-primary/20',
  },
  secondary: {
    bg: 'bg-secondary/10',
    iconBg: 'bg-secondary',
    iconColor: 'text-secondary-foreground',
    border: 'border-secondary/20',
  },
  teal: {
    bg: 'bg-primary/10',
    iconBg: 'bg-primary',
    iconColor: 'text-primary-foreground',
    border: 'border-primary/20',
  },
  blue: {
    bg: 'bg-blue-50',
    iconBg: 'bg-blue-500',
    iconColor: 'text-white',
    border: 'border-blue-200',
  },
  purple: {
    bg: 'bg-purple-50',
    iconBg: 'bg-purple-500',
    iconColor: 'text-white',
    border: 'border-purple-200',
  },
  orange: {
    bg: 'bg-orange-50',
    iconBg: 'bg-orange-500',
    iconColor: 'text-white',
    border: 'border-orange-200',
  },
};

export const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  icon: Icon,
  onClick,
  variant = 'primary',
  className,
}) => {
  const styles = variantStyles[variant];

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-3 rounded-2xl border p-4 transition-all duration-200',
        'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
        styles.bg,
        styles.border,
        className
      )}
    >
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl shadow-sm',
          styles.iconBg
        )}
      >
        <Icon className={cn('h-6 w-6', styles.iconColor)} />
      </div>
      <span className="text-sm font-semibold text-foreground">{title}</span>
    </button>
  );
};
