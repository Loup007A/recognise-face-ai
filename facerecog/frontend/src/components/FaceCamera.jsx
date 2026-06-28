import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useFaceAPI } from '../hooks/useFaceAPI.js';
import { api } from '../utils/api.js';
import RegisterForm from './RegisterForm.jsx';

const SCAN_INTERVAL_MS = 120;
const MATCH_DELAY_MS = 3000; // time before attempting match
const RECOGNITION_THRESHOLD = 15; // frames of stable detection before matching

const s = {
  wrapper: {
    position: 'relative',
    width: '100%',
    maxWidth: 720,
    margin: '0 auto',
  },
  videoContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    background: '#000',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    border: '1px solid var(--border)',
  },
  video: {
    width: '100%', height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)', // mirror
    display: 'block',
  },
  canvas: {
    position: 'absolute',
    top: 0, left: 0,
    width: '100%', height: '100%',
    pointerEvents: 'none',
    transform: 'scaleX(-1)',
  },
  overlay: {
    position: 'absolute', inset: 0,
    pointerEvents: 'none',
  },
  cornerTL: { position: 'absolute', top: 16, left: 16, width: 24, height: 24,
    borderTop: '2px solid var(--accent)', borderLeft: '2px solid var(--accent)' },
  cornerTR: { position: 'absolute', top: 16, right: 16, width: 24, height: 24,
    borderTop: '2px solid var(--accent)', borderRight: '2px solid var(--accent)' },
  cornerBL: { position: 'absolute', bottom: 16, left: 16, width: 24, height: 24,
    borderBottom: '2px solid var(--accent)', borderLeft: '2px solid var(--accent)' },
  cornerBR: { position: 'absolute', bottom: 16, right: 16, width: 24, height: 24,
    borderBottom: '2px solid var(--accent)', borderRight: '2px solid var(--accent)' },
  scanLine: {
    position: 'absolute', left: 0, right: 0,
    height: 1,
    background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
    opacity: 0.5,
    animation: 'scanline 3s linear infinite',
  },
  statusBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'linear-gradient(transparent, rgba(7,7,9,0.95))',
    padding: '32px 16px 12px',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  statusDot: {
    width: 8, height: 8, borderRadius: '50%',
    flexShrink: 0,
  },
  statusText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.78rem',
    color: 'var(--text-mid)',
  },
  progressBar: {
    position: 'absolute', bottom: 0, left: 0,
    height: 2,
    background: 'var(--accent)',
    transition: 'width 0.1s linear',
    boxShadow: '0 0 8px var(--accent)',
  },
  resultCard: {
    marginTop: 16,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px 24px',
    animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
  },
};

function StatusDot({ color }) {
  return <div style={{ ...s.statusDot, background: color, boxShadow: `0 0 6px ${color}` }} />;
}

export default function FaceCamera({ onNewUser }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const stableFrames = useRef(0);
  const matchAttempted = useRef(false);
  const descriptorBuffer = useRef([]);
  const startTimeRef = useRef(null);

  const { faceapi, status: modelStatus } = useFaceAPI();

  const [camStatus, setCamStatus] = useState('idle'); // idle | starting | running | error
  const [scanPhase, setScanPhase] = useState('waiting'); // waiting | scanning | analyzing | matched | unknown
  const [progress, setProgress] = useState(0);
  const [matchResult, setMatchResult] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [pendingDescriptor, setPendingDescriptor] = useState(null);
  const [faceCount, setFaceCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // ── Draw landmarks on canvas ───────────────────────────────────────────────
  const drawDetections = useCallback((detections, videoEl, canvasEl) => {
    if (!faceapi || !canvasEl || !videoEl) return;

    const dims = { width: videoEl.videoWidth, height: videoEl.videoHeight };
    faceapi.matchDimensions(canvasEl, dims);

    const ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

    const resized = faceapi.resizeResults(detections, dims);

    resized.forEach(det => {
      const { box } = det.detection;
      const landmarks = det.landmarks;
      const pts = landmarks.positions;

      // Draw bounding box
      ctx.strokeStyle = 'rgba(0,255,136,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(box.x, box.y, box.width, box.height);
      ctx.stroke();

      // Corner accents on bounding box
      const cSize = 12;
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2.5;
      [[box.x, box.y], [box.x+box.width, box.y], [box.x, box.y+box.height], [box.x+box.width, box.y+box.height]].forEach(([cx, cy], i) => {
        ctx.beginPath();
        const sx = i % 2 === 0 ? 1 : -1;
        const sy = i < 2 ? 1 : -1;
        ctx.moveTo(cx, cy + sy * cSize);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + sx * cSize, cy);
        ctx.stroke();
      });

      // Draw mesh points
      pts.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,204,255,0.9)';
        ctx.fill();
      });

      // Draw landmark connections (jaw, brows, eyes, nose, mouth)
      const groups = [
        landmarks.getJawOutline(),
        landmarks.getLeftEyeBrow(),
        landmarks.getRightEyeBrow(),
        landmarks.getNose(),
        landmarks.getLeftEye(),
        landmarks.getRightEye(),
        landmarks.getMouth(),
      ];

      groups.forEach(group => {
        if (!group || group.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(group[0].x, group[0].y);
        group.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        // Close eyes and mouth
        if (group === landmarks.getLeftEye() || group === landmarks.getRightEye() || group === landmarks.getMouth()) {
          ctx.closePath();
        }
        ctx.strokeStyle = 'rgba(0,204,255,0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Confidence score display
      const conf = Math.round(det.detection.score * 100);
      ctx.fillStyle = 'rgba(7,7,9,0.7)';
      ctx.fillRect(box.x, box.y - 22, 80, 18);
      ctx.fillStyle = '#00ff88';
      ctx.font = '10px Space Mono, monospace';
      ctx.fillText(`CONF ${conf}%`, box.x + 4, box.y - 8);
    });
  }, [faceapi]);

  // ── Start camera ───────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (modelStatus !== 'ready') return;
    setCamStatus('starting');
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamStatus('running');
      setScanPhase('scanning');
      startTimeRef.current = Date.now();
    } catch (err) {
      setErrorMsg(err.name === 'NotAllowedError'
        ? 'Accès à la caméra refusé. Veuillez autoriser l\'accès.'
        : `Erreur caméra: ${err.message}`);
      setCamStatus('error');
    }
  }, [modelStatus]);

  // ── Stop camera ─────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setCamStatus('idle');
    setScanPhase('waiting');
    setProgress(0);
    stableFrames.current = 0;
    matchAttempted.current = false;
    descriptorBuffer.current = [];
  }, []);

  // ── Detection loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (camStatus !== 'running' || !faceapi) return;

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || video.readyState < 2) return;

      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

      try {
        const detections = await faceapi
          .detectAllFaces(video, options)
          .withFaceLandmarks()
          .withFaceDescriptors();

        drawDetections(detections, video, canvas);
        setFaceCount(detections.length);

        if (detections.length === 0) {
          stableFrames.current = 0;
          setProgress(0);
          setScanPhase('scanning');
          return;
        }

        if (matchAttempted.current) return;

        const det = detections[0];
        stableFrames.current++;
        descriptorBuffer.current.push(det.descriptor);

        const prog = Math.min(100, Math.round((stableFrames.current / RECOGNITION_THRESHOLD) * 100));
        setProgress(prog);

        if (stableFrames.current >= RECOGNITION_THRESHOLD) {
          setScanPhase('analyzing');
          matchAttempted.current = true;

          // Average descriptor over buffer for stability
          const avgDescriptor = new Float32Array(128);
          descriptorBuffer.current.forEach(d => d.forEach((v, i) => { avgDescriptor[i] += v; }));
          avgDescriptor.forEach((_, i) => { avgDescriptor[i] /= descriptorBuffer.current.length; });

          setTimeout(async () => {
            try {
              const result = await api.matchFace(avgDescriptor);
              setMatchResult(result);
              if (result.match) {
                setScanPhase('matched');
              } else {
                setScanPhase('unknown');
                setPendingDescriptor(avgDescriptor);
                setShowRegister(true);
              }
            } catch (err) {
              setScanPhase('scanning');
              matchAttempted.current = false;
              stableFrames.current = 0;
            }
          }, 800);
        }
      } catch (err) {
        // silently ignore per-frame errors
      }
    }, SCAN_INTERVAL_MS);

    return () => clearInterval(intervalRef.current);
  }, [camStatus, faceapi, drawDetections]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // ── Status text ────────────────────────────────────────────────────────────
  const statusInfo = {
    waiting: { text: 'Initialisez la caméra', color: 'var(--text-dim)' },
    scanning: { text: faceCount > 0 ? `${faceCount} visage(s) détecté(s) — analyse...` : 'Aucun visage détecté', color: faceCount > 0 ? 'var(--accent2)' : 'var(--text-dim)' },
    analyzing: { text: 'Reconnaissance en cours...', color: 'var(--yellow)' },
    matched: { text: `Identifié : ${matchResult?.user?.name || '—'}`, color: 'var(--accent)' },
    unknown: { text: 'Visage inconnu', color: 'var(--red)' },
  };

  const si = statusInfo[scanPhase] || statusInfo.waiting;

  function resetScan() {
    matchAttempted.current = false;
    stableFrames.current = 0;
    descriptorBuffer.current = [];
    setProgress(0);
    setScanPhase('scanning');
    setMatchResult(null);
    setShowRegister(false);
    setPendingDescriptor(null);
  }

  return (
    <div style={s.wrapper}>
      {/* Camera feed */}
      <div style={s.videoContainer}>
        <video ref={videoRef} style={s.video} muted playsInline />
        <canvas ref={canvasRef} style={s.canvas} />

        {/* Corner brackets */}
        <div style={s.overlay}>
          <div style={s.cornerTL} /><div style={s.cornerTR} />
          <div style={s.cornerBL} /><div style={s.cornerBR} />
          {camStatus === 'running' && <div style={s.scanLine} />}
        </div>

        {/* Progress bar */}
        {progress > 0 && progress < 100 && (
          <div style={{ ...s.progressBar, width: `${progress}%` }} />
        )}

        {/* Status bar */}
        <div style={s.statusBar}>
          <StatusDot color={si.color} />
          <span style={{ ...s.statusText, color: si.color }}>{si.text}</span>
          {camStatus === 'running' && (
            <span style={{ ...s.statusText, marginLeft: 'auto', color: 'var(--text-dim)' }}>
              {scanPhase === 'scanning' && progress > 0 ? `${progress}%` : ''}
            </span>
          )}
        </div>

        {/* Loading overlay */}
        {(modelStatus === 'loading' || camStatus === 'starting') && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', background: 'rgba(7,7,9,0.85)', gap: 12 }}>
            <div style={{ width: 32, height: 32, border: '2px solid var(--border-bright)',
              borderTop: '2px solid var(--accent)', borderRadius: '50%',
              animation: 'rotate 0.8s linear infinite' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-dim)' }}>
              {modelStatus === 'loading' ? 'Chargement des modèles IA...' : 'Démarrage de la caméra...'}
            </span>
          </div>
        )}
      </div>

      {/* Error message */}
      {errorMsg && (
        <div style={{ marginTop: 12, padding: '12px 16px',
          background: 'rgba(255,68,102,0.1)', border: '1px solid rgba(255,68,102,0.3)',
          borderRadius: 'var(--radius)', color: '#ff8899', fontSize: '0.85rem' }}>
          ⚠ {errorMsg}
        </div>
      )}

      {/* Controls */}
      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {camStatus === 'idle' || camStatus === 'error' ? (
          <button
            onClick={startCamera}
            disabled={modelStatus !== 'ready'}
            style={{
              padding: '11px 28px',
              background: modelStatus === 'ready' ? 'var(--accent)' : 'var(--surface2)',
              border: 'none', borderRadius: 'var(--radius)',
              color: modelStatus === 'ready' ? 'var(--bg)' : 'var(--text-dim)',
              fontFamily: 'var(--font-mono)', fontSize: '0.88rem', fontWeight: 700,
              cursor: modelStatus === 'ready' ? 'pointer' : 'not-allowed',
              letterSpacing: '0.04em',
            }}
          >
            {modelStatus === 'loading' ? '⟳ Chargement IA...' : '▶ Activer la caméra'}
          </button>
        ) : (
          <>
            <button onClick={stopCamera} style={{
              padding: '11px 24px',
              background: 'transparent',
              border: '1px solid var(--border-bright)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-mid)', fontFamily: 'var(--font-mono)', fontSize: '0.88rem',
              cursor: 'pointer',
            }}>
              ■ Arrêter
            </button>
            {(scanPhase === 'matched' || scanPhase === 'unknown') && (
              <button onClick={resetScan} style={{
                padding: '11px 24px',
                background: 'rgba(0,204,255,0.1)',
                border: '1px solid rgba(0,204,255,0.3)',
                borderRadius: 'var(--radius)',
                color: 'var(--accent2)', fontFamily: 'var(--font-mono)', fontSize: '0.88rem',
                cursor: 'pointer',
              }}>
                ↺ Nouveau scan
              </button>
            )}
          </>
        )}
      </div>

      {/* Match result card */}
      {matchResult?.match && (
        <div style={{ ...s.resultCard, borderColor: 'rgba(0,255,136,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(0,255,136,0.15)', border: '2px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✓</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
                Bonjour, {matchResult.user.name} !
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                Confiance : {matchResult.confidence}%
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {matchResult.user.age && (
              <span style={{ fontSize: '0.83rem', color: 'var(--text-mid)' }}>
                🎂 {matchResult.user.age} ans
              </span>
            )}
            {matchResult.user.ethnicity && (
              <span style={{ fontSize: '0.83rem', color: 'var(--text-mid)' }}>
                🌍 {matchResult.user.ethnicity}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Register form modal */}
      {showRegister && pendingDescriptor && (
        <RegisterForm
          descriptor={pendingDescriptor}
          onSuccess={(user) => {
            setShowRegister(false);
            setMatchResult({ match: true, user, confidence: 100 });
            setScanPhase('matched');
            if (onNewUser) onNewUser(user);
          }}
          onCancel={() => {
            setShowRegister(false);
            resetScan();
          }}
        />
      )}
    </div>
  );
}
