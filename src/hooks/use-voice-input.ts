import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoiceError = 'not-allowed' | 'network' | 'no-speech' | 'unsupported' | null;

export function useVoiceInput(opts?: { lang?: string }) {
  const lang = opts?.lang ?? 'hi-IN';
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => getRecognitionConstructor() !== null);
  const [voiceError, setVoiceError] = useState<VoiceError>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef<string>('');
  const onTranscriptRef = useRef<((text: string, isFinal: boolean) => void) | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const start = useCallback(
    (onTranscript: (text: string, isFinal: boolean) => void) => {
      const Ctor = getRecognitionConstructor();
      if (!Ctor) { setVoiceError('unsupported'); return; }
      if (recognitionRef.current) recognitionRef.current.abort();
      setVoiceError(null);

      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      transcriptRef.current = '';
      onTranscriptRef.current = onTranscript;

      rec.onstart = () => { setListening(true); setVoiceError(null); };

      rec.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) { transcriptRef.current += result[0].transcript + ' '; }
          else { interim += result[0].transcript; }
        }
        onTranscriptRef.current?.(transcriptRef.current + interim, false);
      };

      rec.onerror = (event: { error: string }) => {
        const err = event.error;
        if (err === 'not-allowed' || err === 'permission-denied') setVoiceError('not-allowed');
        else if (err === 'network') setVoiceError('network');
        else if (err === 'no-speech') setVoiceError('no-speech');
        setListening(false);
      };

      rec.onend = () => {
        setListening(false);
        const finalText = transcriptRef.current.trim();
        if (finalText) onTranscriptRef.current?.(finalText, true);
      };

      recognitionRef.current = rec;
      try { rec.start(); } catch (e) { console.error('[VoiceInput] start error:', e); setListening(false); }
    },
    [lang]
  );

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const clearError = useCallback(() => setVoiceError(null), []);

  return { listening, supported, voiceError, start, stop, clearError };
}
