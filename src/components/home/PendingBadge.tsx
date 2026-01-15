import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PendingBadgeProps {
  title: string;
  subtitle?: string;
  count: number;
  icon: LucideIcon;
  onClick: () => void;
  variant?: 'warning' | 'info' | 'purple' | 'default';
}

const variantStyles = {
  warning: {
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    countColor: 'text-amber-600',
  },
  info: {
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    countColor: 'text-blue-600',
  },
  purple: {
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    countColor: 'text-purple-600',
  },
  default: {
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    countColor: 'text-foreground',
  },
};

export const PendingBadge: React.FC<PendingBadgeProps> = ({
  title,
  subtitle,
  count,
  icon: Icon,
  onClick,
  variant = 'default',
}) => {
  const styles = variantStyles[variant];

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 sm:gap-3 rounded-xl border border-border bg-card p-2.5 sm:p-3 transition-all hover:shadow-sm hover:border-primary/30 active:scale-[0.98] min-w-0 overflow-hidden"
    >
      <div
        className={cn(
          'flex h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-lg',
          styles.iconBg
        )}
      >
        <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', styles.iconColor)} />
      </div>
      <div className="flex-1 text-left min-w-0 overflow-hidden">
        <p className="text-xs sm:text-sm font-medium text-foreground truncate">{title}</p>
        {subtitle && (
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      <span className={cn('text-base sm:text-lg font-bold flex-shrink-0', styles.countColor)}>{count}</span>
    </button>
  );
};
