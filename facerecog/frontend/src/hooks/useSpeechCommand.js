import { useState, useRef, useCallback } from 'react';

/**
 * useSpeechCommand
 * Wraps the Web Speech API (SpeechRecognition) for simple voice commands.
 * Not supported in Firefox; falls back gracefully.
 */
export function useSpeechCommand() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported] = useState(() =>
    typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
  const recognitionRef = useRef(null);

  const start = useCallback((onResult, onEnd) => {
    if (!supported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('');
      setTranscript(text);
      if (event.results[event.results.length - 1].isFinal && onResult) {
        onResult(text.trim());
      }
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      if (onEnd) onEnd();
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [supported]);

  const stop = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
  }, []);

  return { start, stop, listening, transcript, supported };
}

/**
 * speak — simple text-to-speech feedback in French.
 */
export function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  utterance.rate = 1.05;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
