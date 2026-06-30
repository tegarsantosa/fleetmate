import numpy as np
import cv2

FOCAL_LENGTH_PX = 700.0
BASELINE_CM = 12.0
PIXELS_PER_CM_AT_1M = 7.5


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


def _largest_contour_box(gray: np.ndarray):
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 40, 140)
    edges = cv2.dilate(edges, np.ones((5, 5), np.uint8), iterations=2)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    largest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest) < 1500:
        return None
    return cv2.boundingRect(largest)


def _disparity(left_gray: np.ndarray, right_gray: np.ndarray) -> float:
    if left_gray.shape != right_gray.shape:
        return 0.0
    h, w = left_gray.shape[:2]
    if h < 64 or w < 64:
        return 0.0
    target_w = w - (w % 16)
    left_gray = cv2.resize(left_gray, (target_w, h)) if target_w != w else left_gray
    right_gray = cv2.resize(right_gray, (target_w, h)) if target_w != w else right_gray
    matcher = cv2.StereoBM_create(numDisparities=64, blockSize=15)
    disparity_map = matcher.compute(left_gray, right_gray).astype(np.float32) / 16.0
    valid = disparity_map[disparity_map > 0]
    if valid.size == 0:
        return 0.0
    return float(np.median(valid))


def estimate_dimensions(left_bytes: bytes, right_bytes: bytes | None):
    left_img = _decode(left_bytes)
    left_gray = cv2.cvtColor(left_img, cv2.COLOR_BGR2GRAY)
    bbox = _largest_contour_box(left_gray)

    if bbox is None:
        h, w = left_gray.shape[:2]
        bbox = (int(w * 0.25), int(h * 0.25), int(w * 0.5), int(h * 0.5))

    x, y, w_px, h_px = bbox

    distance_cm = 100.0
    confidence = 0.55

    if right_bytes is not None:
        try:
            right_img = _decode(right_bytes)
            right_gray = cv2.cvtColor(right_img, cv2.COLOR_BGR2GRAY)
            if right_gray.shape == left_gray.shape:
                disparity = _disparity(left_gray, right_gray)
                if disparity > 0:
                    distance_cm = (FOCAL_LENGTH_PX * BASELINE_CM) / disparity
                    confidence = 0.9
        except DimensionEstimationError:
            pass

    pixels_per_cm = PIXELS_PER_CM_AT_1M * (100.0 / max(distance_cm, 10.0))

    width_cm = round(w_px / pixels_per_cm, 1)
    height_cm = round(h_px / pixels_per_cm, 1)
    length_cm = round((width_cm + height_cm) / 2 * 0.9, 1)

    width_cm = max(width_cm, 5.0)
    height_cm = max(height_cm, 5.0)
    length_cm = max(length_cm, 5.0)

    return {
        "length_cm": length_cm,
        "width_cm": width_cm,
        "height_cm": height_cm,
        "confidence": round(confidence, 2),
        "distance_cm": round(distance_cm, 1),
        "bbox": {"x": x, "y": y, "w": w_px, "h": h_px},
    }