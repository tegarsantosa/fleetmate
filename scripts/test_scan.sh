#!/usr/bin/env bash
set -euo pipefail

VISION_URL="${VISION_URL:-http://localhost:8001}"
LEFT_IMAGE="${1:-}"
RIGHT_IMAGE="${2:-}"
LABEL="${3:-test-box}"

if [[ -z "$LEFT_IMAGE" ]]; then
  echo "usage: $0 <left_image_path> [right_image_path] [label]"
  exit 1
fi

if [[ ! -f "$LEFT_IMAGE" ]]; then
  echo "left image not found: $LEFT_IMAGE"
  exit 1
fi

echo "checking vision-service health..."
curl -sf "${VISION_URL}/health" | tee /dev/stderr
echo

CURL_ARGS=(-sS -X POST "${VISION_URL}/scan?label=${LABEL}" -F "camera_left=@${LEFT_IMAGE};type=image/jpeg")

if [[ -n "$RIGHT_IMAGE" ]]; then
  if [[ ! -f "$RIGHT_IMAGE" ]]; then
    echo "right image not found: $RIGHT_IMAGE"
    exit 1
  fi
  CURL_ARGS+=(-F "camera_right=@${RIGHT_IMAGE};type=image/jpeg")
fi

echo "uploading ${LEFT_IMAGE} ${RIGHT_IMAGE:+and ${RIGHT_IMAGE}} as label='${LABEL}'..."
curl "${CURL_ARGS[@]}" | python3 -m json.tool