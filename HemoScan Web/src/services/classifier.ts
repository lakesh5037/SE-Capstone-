/**
 * HemoScan AI Inference Service
 *
 * Sends the brain CT image to the PHP backend (analyze.php) which runs
 * the same 3-stage TFLite pipeline as the Android app:
 *   Stage 1 — brain_ct_classifier.tflite  (gatekeeper)
 *   Stage 2 — hemorrhage_detector.tflite  (YOLO NMS)
 *   Stage 3 — Hemorrhage.tflite           (subtype ODT signature)
 *
 * Falls back to a deterministic simulation if the server is unreachable.
 */

// ── Resolve backend URL from env or fall back to same-origin XAMPP path ─────
const BACKEND_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?? 'http://localhost/brainscan_api';
const ANALYZE_URL  = `${BACKEND_BASE}/analyze.php`;

// ── Public types ─────────────────────────────────────────────────────────────

export interface ScanResult {
  validationFailed: boolean;
  validationError?: string;
  hasHemorrhage: boolean;
  highestConfidence: number;
  detectionCount: number;
  processedImageBlob?: Blob;
  processedImageUrl?: string;

  // Subtype probabilities
  intraventricular: number;
  intraparenchymal: number;
  subarachnoid: number;
  epidural: number;
  subdural: number;
  topSubtype?: string;
}

// ── Bounding-box helper (drawn client-side from server coords) ────────────────

interface BoundingBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
  conf: number;
  inputSize: number;
}

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
    img.src = src;
  });

/**
 * Draw the YOLO bounding box on a canvas and return a Blob + object URL.
 * Coordinates are normalised (0-1) relative to inputSize.
 */
const drawBoundingBox = async (
  imageUrl: string,
  box: BoundingBox
): Promise<{ url: string; blob: Blob }> => {
  const img    = await loadImageElement(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width  = img.naturalWidth  || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  // Support both normalized (0-1) and pixel (0-inputSize) coordinates
  const normCx = box.cx > 1.0 ? box.cx / box.inputSize : box.cx;
  const normCy = box.cy > 1.0 ? box.cy / box.inputSize : box.cy;
  const normW  = box.w  > 1.0 ? box.w  / box.inputSize : box.w;
  const normH  = box.h  > 1.0 ? box.h  / box.inputSize : box.h;

  const left   = (normCx - normW / 2) * canvas.width;
  const top    = (normCy - normH / 2) * canvas.height;
  const right  = (normCx + normW / 2) * canvas.width;
  const bottom = (normCy + normH / 2) * canvas.height;

  // Red bounding box
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth   = Math.max(3, canvas.width * 0.006);
  ctx.strokeRect(left, top, right - left, bottom - top);

  // Label
  ctx.fillStyle = '#FF0000';
  ctx.font      = `bold ${Math.max(18, canvas.width * 0.04)}px sans-serif`;
  ctx.fillText(`Hemorrhage: ${(box.conf * 100).toFixed(0)}%`, left + 4, Math.max(top - 6, 20));

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) { reject(new Error('Canvas toBlob failed')); return; }
      resolve({ url: URL.createObjectURL(b), blob: b });
    }, 'image/jpeg', 0.92);
  });
};

// ── initializeModels: no-op now (models live server-side) ────────────────────

export const initializeModels = async (
  onProgress: (status: string) => void
): Promise<boolean> => {
  onProgress('Connecting to AI inference server...');
  // Quick ping to confirm the server is reachable
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(ANALYZE_URL, { method: 'OPTIONS', signal: ctrl.signal });
    clearTimeout(tid);
    if (resp.ok || resp.status === 200 || resp.status === 405) {
      onProgress('AI inference server ready.');
      return true;
    }
  } catch {
    // Server unreachable — simulation mode
    onProgress('Inference server offline. Using simulation engine.');
  }
  return true; // always returns true (fallback handled in processBrainScan)
};

// ── Main scan function ────────────────────────────────────────────────────────

export const processBrainScan = async (
  imageUrl: string,
  imageFile: File
): Promise<ScanResult> => {
  // Send image to PHP backend via multipart POST
  const formData = new FormData();
  formData.append('image', imageFile, imageFile.name);

  let serverResult: any = null;

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 120_000); // 2-min timeout for inference

    const response = await fetch(ANALYZE_URL, {
      method: 'POST',
      body:   formData,
      signal: ctrl.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Server responded with HTTP ${response.status}`);
    }

    serverResult = await response.json();

    if (serverResult?.error) {
      console.error('Inference server error:', serverResult.error, serverResult.trace ?? '');
      throw new Error(serverResult.error);
    }
  } catch (err) {
    console.error('AI inference server unreachable:', err);
    // IMPORTANT: Do NOT run mock simulation — we cannot verify whether the image
    // is a valid CT scan without the real AI models. Return a hard rejection instead.
    return {
      validationFailed:  true,
      validationError:   'AI inference server is offline. Cannot validate CT scan. Please ensure the server is running and try again.',
      hasHemorrhage:     false,
      highestConfidence: 0,
      detectionCount:    0,
      intraventricular:  0, intraparenchymal: 0,
      subarachnoid:      0, epidural:         0, subdural: 0,
    };
  }

  // ── Map server JSON → ScanResult ─────────────────────────────────────────

  if (serverResult.validationFailed) {
    return {
      validationFailed:  true,
      validationError:   serverResult.validationError ?? 'Not a brain CT image',
      hasHemorrhage:     false,
      highestConfidence: 0,
      detectionCount:    0,
      intraventricular:  0, intraparenchymal: 0,
      subarachnoid:      0, epidural:         0, subdural: 0,
    };
  }

  const base: ScanResult = {
    validationFailed:  false,
    hasHemorrhage:     !!serverResult.hasHemorrhage,
    highestConfidence: Number(serverResult.highestConfidence) || 0,
    detectionCount:    Number(serverResult.detectionCount)    || 0,
    intraventricular:  Number(serverResult.intraventricular)  || 0,
    intraparenchymal:  Number(serverResult.intraparenchymal)  || 0,
    subarachnoid:      Number(serverResult.subarachnoid)      || 0,
    epidural:          Number(serverResult.epidural)           || 0,
    subdural:          Number(serverResult.subdural)           || 0,
    topSubtype:        serverResult.topSubtype,
  };

  // Draw bounding box client-side if server returned coordinates
  if (serverResult.hasHemorrhage && serverResult.boundingBox) {
    try {
      const { url, blob } = await drawBoundingBox(imageUrl, serverResult.boundingBox as BoundingBox);
      base.processedImageUrl  = url;
      base.processedImageBlob = blob;
    } catch (drawErr) {
      console.warn('Bounding box drawing failed:', drawErr);
    }
  }

  return base;
};

// ── Simulation fallback (when server is unreachable) ─────────────────────────

interface MockBox { x: number; y: number; w: number; h: number; conf: number; }

export const drawMockBox = (
  img: HTMLImageElement,
  box: MockBox
): { url: string; blob: Blob } => {
  const canvas  = document.createElement('canvas');
  canvas.width  = img.naturalWidth  || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const sw = canvas.width / 640;
  const sh = canvas.height / 640;
  const left   = (box.x - box.w / 2) * sw;
  const top    = (box.y - box.h / 2) * sh;
  const right  = (box.x + box.w / 2) * sw;
  const bottom = (box.y + box.h / 2) * sh;

  ctx.strokeStyle = '#FF6B35';
  ctx.lineWidth   = Math.max(3, canvas.width * 0.005);
  ctx.strokeRect(left, top, right - left, bottom - top);

  ctx.fillStyle = '#FF6B35';
  ctx.font      = `bold ${Math.max(16, canvas.width * 0.035)}px sans-serif`;
  ctx.fillText(`Hemorrhage: ${(box.conf * 100).toFixed(0)}% (simulation)`, left + 4, Math.max(top - 6, 18));

  let url  = '';
  let blob = new Blob();
  canvas.toBlob((b) => {
    if (b) { blob = b; url = URL.createObjectURL(b); }
  }, 'image/jpeg', 0.9);
  return { url, blob };
};

/**
 * Simulation is intentionally disabled.
 * Keeping this stub so the compiler does not complain about unreferenced
 * imports, but it now always returns a server-offline rejection.
 * @deprecated — not called from processBrainScan any more.
 */
export const runMockSimulation = async (
  _imageUrl: string,
  _imageFile: File
): Promise<ScanResult> => {
  return {
    validationFailed:  true,
    validationError:   'AI inference server is offline. Cannot validate CT scan.',
    hasHemorrhage:     false,
    highestConfidence: 0,
    detectionCount:    0,
    intraventricular:  0, intraparenchymal: 0,
    subarachnoid:      0, epidural:         0, subdural: 0,
  };
};
