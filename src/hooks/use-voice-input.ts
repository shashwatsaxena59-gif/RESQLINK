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
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
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

export function useVoiceInput(opts?: { lang?: string }) {
  const lang = opts?.lang ?? 'en-IN';
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => getRecognitionConstructor() !== null);
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
      if (!Ctor) return;
      if (recognitionRef.current) recognitionRef.current.abort();

      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      transcriptRef.current = '';
      onTranscriptRef.current = onTranscript;

      rec.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            transcriptRef.current += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        onTranscriptRef.current?.(transcriptRef.current + interim, false);
      };

      rec.onerror = () => {
        setListening(false);
      };

      rec.onend = () => {
        setListening(false);
        onTranscriptRef.current?.(transcriptRef.current, true);
      };

      recognitionRef.current = rec;
      setListening(true);
      rec.start();
    },
    [lang]
  );

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}
