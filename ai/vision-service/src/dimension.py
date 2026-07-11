import os

import numpy as np
import cv2

MARKER_SIZE_CM = float(os.environ.get("ARUCO_MARKER_SIZE_CM", "5.0"))
DEFAULT_PX_PER_CM = float(os.environ.get("DEFAULT_PX_PER_CM", "15.0"))

_ARUCO_DICT = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
_ARUCO_PARAMS = cv2.aruco.DetectorParameters()
_ARUCO_PARAMS.cornerRefinementMethod = cv2.aruco.CORNER_REFINE_SUBPIX
_ARUCO_DETECTOR = cv2.aruco.ArucoDetector(_ARUCO_DICT, _ARUCO_PARAMS)


class DimensionEstimationError(Exception):
    pass


def _decode(image_bytes: bytes) -> np.ndarray:
    if not image_bytes:
        raise DimensionEstimationError("empty image payload")
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise DimensionEstimationError("could not decode image, unsupported or corrupt file")
    return img


def _detect_marker(gray: np.ndarray):
    corners, ids, _ = _ARUCO_DETECTOR.detectMarkers(gray)
    if ids is None or len(corners) == 0:
        return None
    best = max(corners, key=lambda c: cv2.contourArea(c.reshape(-1, 1, 2).astype(np.float32)))
    return best.reshape(4, 2).astype(np.float32)


def _marker_scale(marker_pts: np.ndarray) -> float:
    sides = [np.linalg.norm(marker_pts[i] - marker_pts[(i + 1) % 4]) for i in range(4)]
    side_px = float(np.mean(sides))
    return side_px / MARKER_SIZE_CM if side_px > 1 else 0.0


def _marker_homography(marker_pts: np.ndarray):
    scale = _marker_scale(marker_pts)
    if scale <= 0:
        return None
    dst = np.array(
        [[0.0, 0.0], [MARKER_SIZE_CM, 0.0], [MARKER_SIZE_CM, MARKER_SIZE_CM], [0.0, MARKER_SIZE_CM]],
        dtype=np.float32,
    )
    H = cv2.getPerspectiveTransform(marker_pts, dst)
    if H is None or not np.all(np.isfinite(H)):
        return None
    return H


def _calibrate(gray: np.ndarray, fallback_ratio: float | None):
    marker_pts = _detect_marker(gray)
    if marker_pts is not None:
        scale = _marker_scale(marker_pts)
        if scale > 0:
            return scale, "aruco_marker", marker_pts, _marker_homography(marker_pts)
    if fallback_ratio and fallback_ratio > 0:
        return float(fallback_ratio), "api_ratio", None, None
    return DEFAULT_PX_PER_CM, "default_ratio", None, None


def _mask_marker(binary: np.ndarray, marker_pts: np.ndarray, fill: int):
    x, y, w, h = cv2.boundingRect(marker_pts.astype(np.int32))
    pad = int(max(w, h) * 0.12) + 4
    cv2.rectangle(binary, (x - pad, y - pad), (x + w + pad, y + h + pad), fill, -1)


def _auto_canny(blurred: np.ndarray) -> np.ndarray:
    v = float(np.median(blurred))
    lo = int(max(0, 0.66 * v))
    hi = int(min(255, 1.33 * v))
    return cv2.Canny(blurred, lo, hi)


def _score_contour(contour) -> float:
    area = cv2.contourArea(contour)
    if area <= 0:
        return 0.0
    (_, (rw, rh), _) = cv2.minAreaRect(contour)
    rect_area = rw * rh
    if rect_area <= 0:
        return 0.0
    return area / rect_area


def _pick_box(contours, frame_area: float, min_area: float):
    best = None
    best_area = 0.0
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area or area > frame_area * 0.97:
            continue
        if _score_contour(c) < 0.55:
            continue
        if area > best_area:
            best, best_area = c, area
    return best


def _isolate(gray: np.ndarray, marker_pts: np.ndarray | None):
    h, w = gray.shape[:2]
    frame_area = float(h * w)
    min_area = max(1200.0, frame_area * 0.01)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    edges = _auto_canny(blurred)
    if marker_pts is not None:
        _mask_marker(edges, marker_pts, 0)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8), iterations=2)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    box = _pick_box(contours, frame_area, min_area)
    if box is not None:
        return box, "canny_contour"

    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if np.count_nonzero(thresh) > thresh.size / 2:
        thresh = cv2.bitwise_not(thresh)
    if marker_pts is not None:
        _mask_marker(thresh, marker_pts, 0)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    box = _pick_box(contours, frame_area, min_area)
    if box is not None:
        return box, "otsu_fallback"

    return None, "center_crop_fallback"


def _refine(contour):
    hull = cv2.convexHull(contour)
    peri = cv2.arcLength(hull, True)
    approx = cv2.approxPolyDP(hull, 0.02 * peri, True)
    return approx if len(approx) >= 4 else hull


def _top_view_dims(gray, ppcm, marker_pts, H):
    contour, method = _isolate(gray, marker_pts)
    h, w = gray.shape[:2]
    if contour is None:
        rect_w, rect_h = w * 0.5, h * 0.5
        bbox = {"x": int(w * 0.25), "y": int(h * 0.25), "w": int(rect_w), "h": int(rect_h)}
        return (rect_w / ppcm, rect_h / ppcm, 0.0, bbox, method)

    contour = _refine(contour)
    x, y, bw, bh = cv2.boundingRect(contour)
    bbox = {"x": int(x), "y": int(y), "w": int(bw), "h": int(bh)}

    if H is not None:
        pts = contour.reshape(-1, 1, 2).astype(np.float32)
        metric = cv2.perspectiveTransform(pts, H).reshape(-1, 1, 2)
        (_, (rw, rh), angle) = cv2.minAreaRect(metric.astype(np.float32))
        length_cm, width_cm = max(rw, rh), min(rw, rh)
    else:
        (_, (rw, rh), angle) = cv2.minAreaRect(contour)
        length_cm, width_cm = max(rw, rh) / ppcm, min(rw, rh) / ppcm

    return length_cm, width_cm, float(angle), bbox, method


def _side_view_height(gray, ppcm, marker_pts):
    contour, method = _isolate(gray, marker_pts)
    if contour is None:
        return None, method
    rows = contour.reshape(-1, 2)[:, 1]
    span = float(np.percentile(rows, 98) - np.percentile(rows, 2))
    if span <= 0:
        _, _, _, bh = cv2.boundingRect(contour)
        span = float(bh)
    return span / ppcm, method


def estimate_dimensions(
    top_bytes: bytes,
    side_bytes: bytes | None,
    fallback_ratio: float | None = None,
):
    top_img = _decode(top_bytes)
    top_gray = cv2.cvtColor(top_img, cv2.COLOR_BGR2GRAY)

    top_ppcm, top_calib, top_marker, top_H = _calibrate(top_gray, fallback_ratio)
    length_cm, width_cm, angle, bbox, top_method = _top_view_dims(
        top_gray, top_ppcm, top_marker, top_H
    )

    height_cm = None
    side_calib = None
    side_method = None
    mode = "single_shot"

    if side_bytes is not None:
        try:
            side_img = _decode(side_bytes)
            side_gray = cv2.cvtColor(side_img, cv2.COLOR_BGR2GRAY)
            side_ppcm, side_calib, side_marker, _ = _calibrate(side_gray, fallback_ratio)
            height_cm, side_method = _side_view_height(side_gray, side_ppcm, side_marker)
            if height_cm is not None:
                mode = "stereo_pair"
        except DimensionEstimationError:
            pass

    if height_cm is None:
        height_cm = 0.75 * (length_cm + width_cm) / 2.0
        side_method = side_method or "estimated_ratio"

    confidence = 0.5
    if top_method == "canny_contour":
        confidence += 0.15
    elif top_method == "otsu_fallback":
        confidence += 0.10
    if top_calib == "aruco_marker":
        confidence += 0.15
        if top_H is not None:
            confidence += 0.08
    elif top_calib == "api_ratio":
        confidence += 0.08
    if mode == "stereo_pair":
        confidence += 0.10
        if side_calib == "aruco_marker":
            confidence += 0.05
    confidence = min(confidence, 0.98)

    clamp = lambda v: max(round(float(v), 1), 5.0)

    return {
        "length_cm": clamp(length_cm),
        "width_cm": clamp(width_cm),
        "height_cm": clamp(height_cm),
        "confidence": round(confidence, 2),
        "mode": mode,
        "rotation_deg": round(angle, 1),
        "bbox": bbox,
        "detection_method_used": {"top": top_method, "side": side_method},
        "calibration_method_used": {"top": top_calib, "side": side_calib},
        "pixels_per_cm": {"top": round(top_ppcm, 2)},
        "rectified": top_H is not None,
        "simulation_mode": True,
    }
