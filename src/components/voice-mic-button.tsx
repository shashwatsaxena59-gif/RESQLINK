import { Mic, MicOff, Square, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VoiceError } from '@/hooks/use-voice-input';

interface VoiceMicButtonProps {
  listening: boolean;
  supported: boolean;
  onStart: () => void;
  onStop: () => void;
  className?: string;
  size?: 'sm' | 'md';
  label?: string;
  voiceError?: VoiceError;
}

export function VoiceMicButton({
  listening,
  supported,
  onStart,
  onStop,
  className,
  size = 'md',
  label,
  voiceError,
}: VoiceMicButtonProps) {
  if (!supported) return <VoiceUnsupportedHint />;

  const sizeClasses = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  const errorMessages: Record<string, string> = {
    'not-allowed': 'Mic blocked — allow in browser settings',
    'network': 'Network error — try again',
    'no-speech': 'No speech detected — try again',
    'unsupported': 'Voice not supported in this browser',
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={listening ? onStop : onStart}
        className={cn(
          'relative flex shrink-0 items-center justify-center rounded-lg border transition-all active:scale-95',
          sizeClasses,
          voiceError
            ? 'border-warning/40 bg-warning/10 text-warning'
            : listening
              ? 'border-alert/40 bg-alert/15 text-alert'
              : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/60',
          className
        )}
        aria-label={listening ? 'Stop voice input' : 'Start voice input'}
        title={listening ? 'Stop voice input' : 'Tap and speak — supports English, Hindi & Hinglish'}
      >
        {listening ? (
          <>
            <span className="absolute inset-0 animate-ping rounded-lg bg-alert/20" />
            <Square className={cn('relative z-10 fill-current', iconSize)} />
          </>
        ) : voiceError ? (
          <AlertCircle className={iconSize} />
        ) : (
          <Mic className={iconSize} />
        )}
        {label && (
          <span className="ml-1.5 text-xs font-semibold">{listening ? 'Listening…' : label}</span>
        )}
      </button>
      {voiceError && errorMessages[voiceError] && (
        <p className="text-[10px] text-warning font-medium text-right">{errorMessages[voiceError]}</p>
      )}
    </div>
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
