/**
 * PhoneLink — renders a phone number as a tappable tel: link.
 *
 * Mobile  → opens native dialer
 * Desktop → opens associated VoIP / calling app if one exists,
 *           otherwise shows a copy-to-clipboard fallback.
 */
import { useState, useCallback } from 'react';
import { Phone, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhoneLinkProps {
  number: string;                   // raw number, e.g. "+91 98xxx xx142" or "112"
  className?: string;
  showIcon?: boolean;
  variant?: 'inline' | 'button';   // inline = text link, button = pill button
}

/** Strip spaces/dashes so tel: link works reliably */
function toTelHref(n: string) {
  return 'tel:' + n.replace(/[\s\-().]/g, '');
}

export function PhoneLink({ number, className, showIcon = true, variant = 'inline' }: PhoneLinkProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(number.replace(/\s/g, '')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [number]);

  if (variant === 'button') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <a
          href={toTelHref(number)}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40
            px-2.5 py-1.5 text-[11px] font-bold text-foreground
            transition-colors hover:bg-secondary hover:text-info active:scale-95"
          aria-label={`Call ${number}`}
        >
          <Phone className="h-3 w-3 text-info" />
          {number}
        </a>
        <button
          onClick={handleCopy}
          title="Copy number"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border
            bg-secondary/40 text-muted-foreground transition-colors
            hover:bg-secondary hover:text-foreground active:scale-95"
          aria-label="Copy phone number"
        >
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    );
  }

  // inline variant
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {showIcon && <Phone className="h-3 w-3 shrink-0 text-info" />}
      <a
        href={toTelHref(number)}
        onClick={(e) => e.stopPropagation()}
        className="font-medium text-info underline-offset-2 hover:underline active:opacity-70"
        aria-label={`Call ${number}`}
      >
        {number}
      </a>
      <button
        onClick={handleCopy}
        title="Copy number"
        className="ml-0.5 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Copy phone number"
      >
        {copied ? <Check className="h-2.5 w-2.5 text-success" /> : <Copy className="h-2.5 w-2.5" />}
      </button>
    </span>
  );
}
