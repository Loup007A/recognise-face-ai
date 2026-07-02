import { useState, useEffect, useRef } from 'react';

// face-api.js models are served from /models in public directory
// Download them from: https://github.com/justadudewhohacks/face-api.js/tree/master/weights
const MODEL_URL = '/models';

let faceapi = null;
let modelsLoaded = false;

export function useFaceAPI() {
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState(null);

  useEffect(() => {
    if (modelsLoaded && faceapi) {
      setStatus('ready');
      return;
    }

    async function load() {
      setStatus('loading');
      try {
        // Dynamic import to avoid SSR issues
        const fa = await import('face-api.js');
        faceapi = fa;

        await Promise.all([
          fa.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          fa.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          fa.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);

        modelsLoaded = true;
        setStatus('ready');
      } catch (err) {
        console.error('Failed to load face-api models:', err);
        setError(err.message);
        setStatus('error');
      }
    }

    load();
  }, []);

  return { faceapi, status, error };
}

export { faceapi as getFaceAPI };
