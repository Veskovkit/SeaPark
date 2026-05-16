import { useState, useCallback } from 'react';
import { analyzeViolationPhoto as analyzePhoto } from '../lib/gemini';

export function useGemini() {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => setError(null), []);

  const analyzeViolationPhoto = useCallback(
    async (imageBase64, mimeType, zoneContext) => {
      setAnalyzing(true);
      setError(null);
      try {
        return await analyzePhoto(imageBase64, mimeType, zoneContext);
      } catch (err) {
        const message =
          err instanceof SyntaxError
            ? 'AI returned invalid JSON. Try another photo or submit without analysis.'
            : err?.message ||
              'Photo analysis failed. Check your Gemini API key and try again.';
        setError(message);
        throw new Error(message, { cause: err });
      } finally {
        setAnalyzing(false);
      }
    },
    [],
  );

  return { analyzeViolationPhoto, analyzing, error, clearError };
}
