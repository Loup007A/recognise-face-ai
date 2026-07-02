/**
 * voiceFeatures.js
 * Extracts a 32-dimensional "voiceprint" from a recorded audio sample,
 * using the Web Audio API (AnalyserNode + FFT). This is a simplified
 * spectral-energy fingerprint (NOT a state-of-the-art speaker embedding),
 * but is sufficient to tell speakers apart for a demo.
 */

const VECTOR_LENGTH = 32;
const RECORD_DURATION_MS = 2500;

/**
 * Records a short audio clip and returns a normalized 32-dim feature vector.
 */
export async function captureVoicePrint(onProgress) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.6;
  source.connect(analyser);

  const freqBins = analyser.frequencyBinCount; // 1024
  const bucketSize = Math.floor(freqBins / VECTOR_LENGTH);
  const accumulator = new Float64Array(VECTOR_LENGTH);
  let frameCount = 0;

  const dataArray = new Uint8Array(freqBins);
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    function frame() {
      const elapsed = Date.now() - startTime;
      if (onProgress) onProgress(Math.min(100, Math.round((elapsed / RECORD_DURATION_MS) * 100)));

      analyser.getByteFrequencyData(dataArray);

      // Bucket the frequency bins into VECTOR_LENGTH groups and average energy
      for (let i = 0; i < VECTOR_LENGTH; i++) {
        let sum = 0;
        const start = i * bucketSize;
        const end = start + bucketSize;
        for (let j = start; j < end; j++) sum += dataArray[j];
        accumulator[i] += sum / bucketSize;
      }
      frameCount++;

      if (elapsed < RECORD_DURATION_MS) {
        requestAnimationFrame(frame);
      } else {
        // Cleanup
        stream.getTracks().forEach(t => t.stop());
        source.disconnect();
        audioCtx.close();

        if (frameCount === 0) {
          reject(new Error('Aucune donnée audio capturée.'));
          return;
        }

        // Average over all frames
        const avg = Array.from(accumulator).map(v => v / frameCount);

        // Normalize vector (L2 norm) so volume differences matter less
        const norm = Math.sqrt(avg.reduce((s, v) => s + v * v, 0)) || 1;
        const normalized = avg.map(v => v / norm);

        resolve(normalized);
      }
    }
    requestAnimationFrame(frame);
  });
}

export { VECTOR_LENGTH, RECORD_DURATION_MS };
