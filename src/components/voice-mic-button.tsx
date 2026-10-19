import { Mic, MicOff, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceMicButtonProps {
  listening: boolean;
  supported: boolean;
  onStart: () => void;
  onStop: () => void;
  className?: string;
  size?: 'sm' | 'md';
  label?: string;
}

export function VoiceMicButton({
  listening,
  supported,
  onStart,
  onStop,
  className,
  size = 'md',
  label,
}: VoiceMicButtonProps) {
  if (!supported) return null;

  const sizeClasses = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <button
      type="button"
      onClick={listening ? onStop : onStart}
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-lg border transition-all active:scale-95',
        sizeClasses,
        listening
          ? 'border-alert/40 bg-alert/15 text-alert'
          : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/60',
        className
      )}
      aria-label={listening ? 'Stop voice input' : 'Start voice input'}
      title={listening ? 'Stop voice input' : 'Tap and speak to fill this field'}
    >
      {listening ? (
        <>
          <span className="absolute inset-0 animate-ping rounded-lg bg-alert/20" />
          <Square className={cn('relative z-10 fill-current', iconSize)} />
        </>
      ) : (
        <Mic className={iconSize} />
      )}
      {label && (
        <span className="ml-1.5 text-xs font-semibold">{listening ? 'Listening…' : label}</span>
      )}
    </button>
  );
}

export function VoiceUnsupportedHint() {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
      <MicOff className="h-3 w-3" />
      <span>Voice input needs Chrome or Edge</span>
    </div>
  );
}
