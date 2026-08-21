#!/usr/bin/env python3
"""
HemoScan AI Inference Engine
Mirrors the Android YoloHelper 3-stage pipeline exactly:
  Stage 1: ClassifierHelper  (brain_ct_classifier.tflite) — gatekeeper
  Stage 2: DetectorHelper    (hemorrhage_detector.tflite)  — YOLO NMS
  Stage 3: SubtypeClassifier (Hemorrhage.tflite)           — ODT signature

AUTO-SETUP: Automatically installs required packages on first run.
No manual setup needed — just copy files to XAMPP and go.
"""

import sys
import os
import subprocess

# ── Auto-installer: runs silently on first use ────────────────────────────────
def _ensure_packages():
    """Install required packages automatically if not present."""
    required = {
        'ai_edge_litert': 'ai-edge-litert',
        'numpy':          'numpy',
        'PIL':            'Pillow',
    }
    missing = []
    for module, package in required.items():
        try:
            __import__(module)
        except ImportError:
            missing.append(package)

    if missing:
        sys.stderr.write(f"[HemoScan] Auto-installing: {', '.join(missing)}...\n")
        try:
            subprocess.check_call(
                [sys.executable, '-m', 'pip', 'install', '--quiet'] + missing,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            sys.stderr.write("[HemoScan] Auto-install complete.\n")
        except Exception as e:
            sys.stderr.write(f"[HemoScan] Auto-install failed: {e}\n")
            sys.stderr.write("[HemoScan] Run manually: pip install ai-edge-litert numpy Pillow\n")

_ensure_packages()

# ── Imports (after auto-install) ─────────────────────────────────────────────
import json

try:
    from ai_edge_litert.interpreter import Interpreter
except ImportError:
    try:
        from tflite_runtime.interpreter import Interpreter
    except ImportError:
        try:
            import tensorflow as tf
            Interpreter = tf.lite.Interpreter
        except ImportError:
            print(json.dumps({"error": "No TFLite runtime available. Run: pip install ai-edge-litert"}))
            sys.exit(1)

try:
    import numpy as np
    from PIL import Image
except ImportError as e:
    print(json.dumps({"error": f"Missing dependency: {e}. Run: pip install numpy Pillow"}))
    sys.exit(1)

# ── Resolve models directory ─────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(SCRIPT_DIR, "models")

MODEL_GATEKEEPER = os.path.join(MODELS_DIR, "brain_ct_classifier.tflite")
MODEL_DETECTOR   = os.path.join(MODELS_DIR, "hemorrhage_detector.tflite")
MODEL_SUBTYPE    = os.path.join(MODELS_DIR, "Hemorrhage.tflite")

# ── Thresholds matching DetectorHelper.java ───────────────────────────────────
CONFIDENCE_THRESHOLD = 0.35
IOU_THRESHOLD        = 0.25


# ── Image helpers ─────────────────────────────────────────────────────────────

def load_and_resize(image_path: str, target_size: int) -> np.ndarray:
    """Load image, resize to square, return float32 RGB [H,W,3] normalised 0-1."""
    img = Image.open(image_path).convert("RGB")
    img = img.resize((target_size, target_size), Image.BILINEAR)
    return np.array(img, dtype=np.float32) / 255.0


def preprocess_rgb(arr: np.ndarray) -> np.ndarray:
    """Matching ClassifierHelper / DetectorHelper: [1,H,W,3] RGB 0-1."""
    return arr[np.newaxis, :]


def preprocess_grayscale(arr: np.ndarray) -> np.ndarray:
    """Matching SubtypeClassifierHelper: grayscale replicated across 3 channels."""
    gray = 0.299 * arr[:,:,0] + 0.587 * arr[:,:,1] + 0.114 * arr[:,:,2]
    gray3 = np.stack([gray, gray, gray], axis=-1)
    return gray3[np.newaxis, :]


# ── TFLite runner helpers ─────────────────────────────────────────────────────

def run_standard(interp, input_data: np.ndarray) -> np.ndarray:
    """Run a standard TFLite model (non-signature)."""
    inp = interp.get_input_details()
    out = interp.get_output_details()
    interp.resize_tensor_input(inp[0]['index'], input_data.shape)
    interp.allocate_tensors()
    interp.set_tensor(inp[0]['index'], input_data)
    interp.invoke()
    return interp.get_tensor(out[0]['index'])


def run_signature(interp, input_data: np.ndarray) -> np.ndarray:
    """
    Run ODT model via 'infer' signature.
    Matches SubtypeClassifierHelper: interpreter.runSignature(inputs, outputs, "infer")
    Input key: 'x', Output key: 'probs'
    """
    runner  = interp.get_signature_runner('infer')
    outputs = runner(x=input_data)
    return outputs['probs']


def iou(a: dict, b: dict) -> float:
    """Intersection-over-Union — matching DetectorHelper.iou()."""
    al, at = a['x'] - a['w']/2, a['y'] - a['h']/2
    ar, ab = a['x'] + a['w']/2, a['y'] + a['h']/2
    bl, bt = b['x'] - b['w']/2, b['y'] - b['h']/2
    br, bb = b['x'] + b['w']/2, b['y'] + b['h']/2
    il, it = max(al, bl), max(at, bt)
    ir, ib = min(ar, br), min(ab, bb)
    if ir < il or ib < it:
        return 0.0
    inter = (ir - il) * (ib - it)
    union = a['w']*a['h'] + b['w']*b['h'] - inter
    return inter / union if union > 0 else 0.0


# ── Stage 1 — Gatekeeper (ClassifierHelper.java) ─────────────────────────────

def stage1_gatekeeper(image_path: str) -> bool:
    interp     = Interpreter(model_path=MODEL_GATEKEEPER)
    input_size = interp.get_input_details()[0]['shape'][1]

    arr  = load_and_resize(image_path, input_size)
    out  = run_standard(interp, preprocess_rgb(arr).astype(np.float32))
    probs = out[0]

    if len(probs) == 1:
        return float(probs[0]) >= 0.5          # sigmoid: >= 0.5 → brain_ct
    else:
        return float(probs[0]) >= float(probs[1])  # softmax: index 0 = brain_ct


# ── Stage 2 — YOLO Detector (DetectorHelper.java) ────────────────────────────

def stage2_detector(image_path: str) -> dict:
    interp     = Interpreter(model_path=MODEL_DETECTOR)
    inp        = interp.get_input_details()
    input_size = inp[0]['shape'][1]

    arr = load_and_resize(image_path, input_size)
    interp.resize_tensor_input(inp[0]['index'], preprocess_rgb(arr).shape)
    interp.allocate_tensors()
    interp.set_tensor(inp[0]['index'], preprocess_rgb(arr).astype(np.float32))
    interp.invoke()
    raw = interp.get_tensor(interp.get_output_details()[0]['index'])  # [1, dim1, dim2]

    dim1, dim2    = raw.shape[1], raw.shape[2]
    is_transposed = dim1 < dim2
    num_boxes     = dim2 if is_transposed else dim1
    num_elements  = dim1 if is_transposed else dim2

    # Matching DetectorHelper hasObjectness / classes logic
    if num_elements > 5 and (num_elements % 2 != 0 or num_elements < 10):
        has_obj = True;  classes = num_elements - 5
    else:
        has_obj = False; classes = num_elements - 4

    boxes = []
    max_conf = 0.0

    for i in range(num_boxes):
        if is_transposed:
            cx, cy, w, h = raw[0][0][i], raw[0][1][i], raw[0][2][i], raw[0][3][i]
            mc = max(raw[0][5+c if has_obj else 4+c][i] for c in range(classes))
            conf = float(raw[0][4][i]) * float(mc) if has_obj else float(mc)
        else:
            cx, cy, w, h = raw[0][i][0], raw[0][i][1], raw[0][i][2], raw[0][i][3]
            mc = max(raw[0][i][5+c if has_obj else 4+c] for c in range(classes))
            conf = float(raw[0][i][4]) * float(mc) if has_obj else float(mc)

        if conf > max_conf:
            max_conf = conf
        if conf > CONFIDENCE_THRESHOLD:
            boxes.append({'x': float(cx), 'y': float(cy), 'w': float(w), 'h': float(h), 'conf': conf})

    boxes.sort(key=lambda b: b['conf'], reverse=True)

    # NMS — matching DetectorHelper.java
    nms = []
    while boxes:
        best = boxes.pop(0)
        nms.append(best)
        boxes = [b for b in boxes if iou(best, b) < IOU_THRESHOLD]

    if len(nms) > 1:          # Keep single best box only (Android behaviour)
        nms = [nms[0]]

    return {
        'hasHemorrhage':     len(nms) > 0,
        'highestConfidence': nms[0]['conf'] if nms else max_conf,
        'detectionCount':    len(nms),
        'topBox':            nms[0] if nms else None,
        'inputSize':         int(input_size),
    }


# ── Stage 3 — Subtype Classifier (SubtypeClassifierHelper.java) ──────────────

def stage3_subtype(image_path: str) -> list:
    interp     = Interpreter(model_path=MODEL_SUBTYPE)
    input_size = 224  # Fixed in SubtypeClassifierHelper.inputSize

    arr = load_and_resize(image_path, input_size)
    inp = preprocess_grayscale(arr).astype(np.float32)

    # Try ODT 'infer' signature first (matching runSignature call in Java)
    try:
        probs = run_signature(interp, inp)
        return (probs[0] if len(probs.shape) > 1 else probs).tolist()
    except Exception as e:
        sys.stderr.write(f"[HemoScan] Signature runner failed ({e}), using standard invoke\n")
        out = run_standard(interp, inp)
        return out[0].tolist()


# ── Main entry point ──────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: inference.py <image_path>"}))
        sys.exit(1)

    image_path = sys.argv[1]
    if not os.path.isfile(image_path):
        print(json.dumps({"error": f"Image not found: {image_path}"}))
        sys.exit(1)

    # Validate model files exist
    for model, path in [("Gatekeeper", MODEL_GATEKEEPER),
                         ("Detector",   MODEL_DETECTOR),
                         ("Subtype",    MODEL_SUBTYPE)]:
        if not os.path.isfile(path):
            print(json.dumps({"error": f"{model} model not found at: {path}"}))
            sys.exit(1)

    try:
        # ── Stage 1
        if not stage1_gatekeeper(image_path):
            print(json.dumps({
                "validationFailed":  True,
                "validationError":   "Input rejected: not a brain CT image",
                "hasHemorrhage":     False,
                "highestConfidence": 0.0,
                "detectionCount":    0,
                "intraventricular":  0.0, "intraparenchymal": 0.0,
                "subarachnoid":      0.0, "epidural":         0.0, "subdural": 0.0,
            }))
            return

        # ── Stage 2
        det = stage2_detector(image_path)

        result = {
            "validationFailed":  False,
            "hasHemorrhage":     det['hasHemorrhage'],
            "highestConfidence": det['highestConfidence'],
            "detectionCount":    det['detectionCount'],
        }

        if det['hasHemorrhage'] and det['topBox']:
            # ── Stage 3
            probs = stage3_subtype(image_path)
            while len(probs) < 5:
                probs.append(0.0)

            names   = ['Intraventricular', 'Intraparenchymal', 'Subarachnoid', 'Epidural', 'Subdural']
            top_idx = probs.index(max(probs))

            result.update({
                "intraventricular": float(probs[0]),
                "intraparenchymal": float(probs[1]),
                "subarachnoid":     float(probs[2]),
                "epidural":         float(probs[3]),
                "subdural":         float(probs[4]),
                "topSubtype":       f"{names[top_idx]} ({probs[top_idx]*100:.1f}%)",
                "boundingBox": {
                    "cx":        det['topBox']['x'],
                    "cy":        det['topBox']['y'],
                    "w":         det['topBox']['w'],
                    "h":         det['topBox']['h'],
                    "conf":      det['topBox']['conf'],
                    "inputSize": det['inputSize'],
                },
            })
        else:
            result.update({
                "intraventricular": 0.0, "intraparenchymal": 0.0,
                "subarachnoid":     0.0, "epidural":         0.0, "subdural": 0.0,
            })

        print(json.dumps(result))

    except Exception as e:
        import traceback
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)


if __name__ == "__main__":
    main()
