import React from 'react';
import {
  HardDrive,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  getTruthfulStatusMeta,
  type SyncQueueItemStatus,
  type TruthfulSyncStatus,
  normalizeTruthfulStatus,
} from '@/domain/models/sync-metadata';

interface SyncTruthfulBadgeProps {
  status: SyncQueueItemStatus | undefined;
  className?: string;
  showIcon?: boolean;
  showDescriptionTooltip?: boolean;
  serverAckTimestamp?: string | null;
}

export function SyncTruthfulBadge({
  status,
  className,
  showIcon = true,
  serverAckTimestamp,
}: SyncTruthfulBadgeProps) {
  const meta = getTruthfulStatusMeta(status);
  const normalized: TruthfulSyncStatus = normalizeTruthfulStatus(status);

  const renderIcon = () => {
    switch (normalized) {
      case 'saved_locally':
        return <HardDrive className="h-3 w-3 shrink-0" />;
      case 'waiting_to_sync':
        return <Clock className="h-3 w-3 shrink-0" />;
      case 'synchronizing':
        return <RefreshCw className="h-3 w-3 shrink-0 animate-spin" />;
      case 'confirmed_by_server':
        return <CheckCircle2 className="h-3 w-3 shrink-0" />;
      case 'failed':
        return <AlertTriangle className="h-3 w-3 shrink-0" />;
      case 'conflict':
        return <AlertCircle className="h-3 w-3 shrink-0" />;
    }
  };

  return (
    <span
      className="inline-flex items-center group relative"
      title={
        normalized === 'confirmed_by_server' && serverAckTimestamp
          ? `${meta.description} (Ack: ${new Date(serverAckTimestamp).toLocaleTimeString()})`
          : meta.description
      }
    >
      <Badge
        variant={meta.badgeVariant}
        className={cn(
          'text-[10px] font-mono tracking-tight uppercase px-2 py-0.5 gap-1.5 transition-colors border',
          meta.colorClass,
          className
        )}
      >
        {showIcon && renderIcon()}
        <span>{meta.label}</span>
      </Badge>
    </span>
  );
}
