"""FleetMate packing engine — corner-anchor placement with physics guards.

The engine packs axis-aligned boxes into a single container with gravity,
in three stages, wrapped in Random-Restart Hill Climbing:

  1. CANDIDATE ANCHORS — every placement is tried at the corner grid formed
     by the container origin and the edges of already-placed boxes (both the
     near and far edge on each axis). This is a strict superset of the
     classic Extreme-Point set, so nothing EP could find is ever missed,
     while seams BETWEEN boxes (where EP has no point) become reachable.
  2. GRAVITY + SUPPORT — the trial z at an anchor is the highest box top
     under the footprint (or the floor). A box may rest at z>0 only if
     ≥ SUPPORT_MIN_RATIO of its bottom face sits on box tops at exactly
     that height: nothing ever floats.
  3. SCORING — lowest first: z (floor first), then x (cab first), then y
     (left wall first), then HIGHEST contact area (bottom + touching walls
     and neighbour faces). Contact-maximisation is what glues boxes into
     flush rows instead of leaving slivers of daylight between columns.
     A Center-of-Gravity soft penalty keeps the load balanced once a few
     boxes are aboard.

  After a full sequence is placed, a COMPACTION pass slides every new box
  toward the cab (-x) then the left wall (-y) until it touches something,
  in placement order, repeated to a fixpoint. Boxes that carry other boxes
  and pre-existing (already persisted) placements never move.

  RRHC: the sequence starts volume-sorted, then up to MAX_RESTARTS
  perturbations; the best result wins by (boxes placed, packed volume,
  smallest used footprint).

Axes: x runs along container LENGTH (cab at x=0), y along WIDTH, z is
HEIGHT. Positions are the box's min corner, in cm. All container dims are
used VERBATIM as the packable space — cosmetic 3D-viewer geometry (chassis,
teal base rail, wall cladding) lives OUTSIDE this space by design.
"""

import random
from dataclasses import dataclass

# ---- tuning ----
MAX_RESTARTS = 6          # RRHC restarts for small loads (adaptive below)
SHUFFLE_STRENGTH = 0.35   # fraction of the sequence perturbed per restart
SUPPORT_MIN_RATIO = 0.85  # min fraction of the bottom face that must rest
COG_Y_TOLERANCE = 0.18    # lateral CoG drift tolerance (fraction of half-width)
COG_X_TOLERANCE = 0.25    # longitudinal tolerance (fraction of half-length)
COG_PENALTY = 5e4
MIN_COG_BOXES = 3
EPS = 1e-6

_rng = random.Random(0xF1EE7)  # seeded → reproducible plans


@dataclass
class Space:  # kept for backward compatibility with older imports
    x: float
    y: float
    z: float
    length: float
    width: float
    height: float

    @property
    def volume(self):
        return self.length * self.width * self.height


@dataclass
class PlacedBox:
    box_id: str
    x: float
    y: float
    z: float
    length: float
    width: float
    height: float
    rot_x: int = 0
    rot_y: int = 0
    rot_z: int = 0


def _split_space(space: Space, l, w, h):
    """Legacy guillotine split — kept only so old imports don't break."""
    remainders = []
    if space.length - l > EPS:
        remainders.append(Space(space.x + l, space.y, space.z, space.length - l, w, h))
    if space.width - w > EPS:
        remainders.append(Space(space.x, space.y + w, space.z, space.length, space.width - w, h))
    if space.height - h > EPS:
        remainders.append(Space(space.x, space.y, space.z + h, space.length, space.width, space.height - h))
    return remainders


# ---------- orientations ----------

def _unique_orientations(length, width, height):
    """All axis-aligned rotations, deduplicated (a cube has 1, not 6)."""
    seen = set()
    out = []
    for l, w, h, rx, ry, rz in (
        (length, width, height, 0, 0, 0),
        (width, length, height, 0, 0, 90),
        (length, height, width, 90, 0, 0),
        (height, length, width, 90, 0, 90),
        (width, height, length, 0, 90, 0),
        (height, width, length, 0, 90, 90),
    ):
        key = (round(l, 4), round(w, 4), round(h, 4))
        if key not in seen:
            seen.add(key)
            out.append((l, w, h, rx, ry, rz))
    return out


# ---------- geometry primitives ----------

def _xy_overlap(x, y, l, w, p):
    """Overlap area of footprint (x,y,l,w) with placement p's footprint."""
    ox = min(x + l, p.x + p.length) - max(x, p.x)
    oy = min(y + w, p.y + p.width) - max(y, p.y)
    return ox * oy if (ox > EPS and oy > EPS) else 0.0


def _overlaps_3d(x, y, z, l, w, h, placements, skip=None):
    for p in placements:
        if p is skip:
            continue
        if (
            x < p.x + p.length - EPS and x + l > p.x + EPS
            and y < p.y + p.width - EPS and y + w > p.y + EPS
            and z < p.z + p.height - EPS and z + h > p.z + EPS
        ):
            return True
    return False


def _support_height(x, y, l, w, placements):
    """Where gravity puts the box at this anchor: the tallest top under it."""
    z = 0.0
    for p in placements:
        if _xy_overlap(x, y, l, w, p) > EPS:
            z = max(z, p.z + p.height)
    return z


def _support_ratio(x, y, z, l, w, placements, skip=None):
    """Fraction of the bottom face resting on box tops at exactly height z."""
    if z <= EPS:
        return 1.0
    area = l * w
    sup = 0.0
    for p in placements:
        if p is skip or abs(p.z + p.height - z) > 1e-4:
            continue
        sup += _xy_overlap(x, y, l, w, p)
    return sup / area


def _contact_area(x, y, z, l, w, h, placements, tL, tW):
    """Total face area touching the floor/walls/neighbours — the 'glue' score
    that makes the packer build flush rows instead of scattered islands."""
    contact = 0.0
    if z <= EPS:
        contact += l * w                     # floor
    if x <= EPS:
        contact += w * h                     # front wall (cab side)
    if abs(x + l - tL) <= 1e-4:
        contact += w * h                     # rear doors
    if y <= EPS:
        contact += l * h                     # left wall
    if abs(y + w - tW) <= 1e-4:
        contact += l * h                     # right wall
    for p in placements:
        # face-to-face on x
        if abs(p.x + p.length - x) <= 1e-4 or abs(x + l - p.x) <= 1e-4:
            oy = min(y + w, p.y + p.width) - max(y, p.y)
            oz = min(z + h, p.z + p.height) - max(z, p.z)
            if oy > EPS and oz > EPS:
                contact += oy * oz
        # face-to-face on y
        if abs(p.y + p.width - y) <= 1e-4 or abs(y + w - p.y) <= 1e-4:
            ox = min(x + l, p.x + p.length) - max(x, p.x)
            oz = min(z + h, p.z + p.height) - max(z, p.z)
            if ox > EPS and oz > EPS:
                contact += ox * oz
        # resting on p
        if abs(p.z + p.height - z) <= 1e-4:
            contact += _xy_overlap(x, y, l, w, p)
    return contact


def _candidate_anchors(placements, tL, tW):
    """Corner grid: container origin plus every box edge on each axis."""
    xs = {0.0}
    ys = {0.0}
    for p in placements:
        xs.add(round(p.x, 4))
        xs.add(round(p.x + p.length, 4))
        ys.add(round(p.y, 4))
        ys.add(round(p.y + p.width, 4))
    return (
        sorted(v for v in xs if v < tL - EPS),
        sorted(v for v in ys if v < tW - EPS),
    )


# ---------- core: pack one sequence ----------

def _pack_sequence(seq, tL, tW, tH, existing, max_weight):
    placements = list(existing)
    placed = []
    unplaced = []
    # Weight of the pre-existing load is unknown (plan items don't store kg),
    # so the limit — when provided — applies to THIS packing run's additions.
    total_weight = 0.0
    cog_sum_x = sum((p.x + p.length / 2) * (p.length * p.width * p.height) for p in placements)
    cog_sum_y = sum((p.y + p.width / 2) * (p.length * p.width * p.height) for p in placements)
    cog_total = sum(p.length * p.width * p.height for p in placements)

    for box in seq:
        L = float(box["length_cm"])
        W = float(box["width_cm"])
        H = float(box["height_cm"])
        mass = float(box.get("weight_kg") or (L * W * H) / 1000.0)

        if max_weight is not None and total_weight + mass > max_weight + EPS:
            unplaced.append(box)
            continue

        xs, ys = _candidate_anchors(placements, tL, tW)
        best = None
        for (l, w, h, rx, ry, rz) in _unique_orientations(L, W, H):
            if h > tH + EPS:
                continue
            for ax in xs:
                if ax + l > tL + EPS:
                    continue
                for ay in ys:
                    if ay + w > tW + EPS:
                        continue
                    z = _support_height(ax, ay, l, w, placements)
                    if z + h > tH + EPS:
                        continue
                    if z > EPS and _support_ratio(ax, ay, z, l, w, placements) < SUPPORT_MIN_RATIO:
                        continue
                    # z is the max top under the footprint, so nothing can
                    # intersect [z, z+h] there — checked anyway for safety.
                    if _overlaps_3d(ax, ay, z, l, w, h, placements):
                        continue

                    contact = _contact_area(ax, ay, z, l, w, h, placements, tL, tW)
                    f = z * 1e9 + ax * 1e4 + ay * 10 - contact * 1e-3

                    if len(placements) >= MIN_COG_BOXES and cog_total > 0:
                        m = cog_total + mass
                        cx = (cog_sum_x + mass * (ax + l / 2)) / m
                        cy = (cog_sum_y + mass * (ay + w / 2)) / m
                        drift_x = abs(cx - tL / 2) / (tL / 2)
                        drift_y = abs(cy - tW / 2) / (tW / 2)
                        if drift_x > COG_X_TOLERANCE:
                            f += COG_PENALTY * (drift_x - COG_X_TOLERANCE)
                        if drift_y > COG_Y_TOLERANCE:
                            f += COG_PENALTY * (drift_y - COG_Y_TOLERANCE)

                    if best is None or f < best[0]:
                        best = (f, ax, ay, z, l, w, h, rx, ry, rz)

        if best is None:
            unplaced.append(box)
            continue

        _, x, y, z, l, w, h, rx, ry, rz = best
        p = PlacedBox(box_id=box["id"], x=x, y=y, z=z,
                      length=l, width=w, height=h, rot_x=rx, rot_y=ry, rot_z=rz)
        placements.append(p)
        placed.append(p)
        total_weight += mass
        cog_sum_x += mass * (x + l / 2)
        cog_sum_y += mass * (y + w / 2)
        cog_total += mass

    _compact(placed, placements)
    return placed, unplaced


# ---------- compaction ----------

def _carries_load(p, placements):
    """True if any other box rests on top of p (then p must not move)."""
    for q in placements:
        if q is p:
            continue
        if abs(q.z - (p.z + p.height)) <= 1e-4 and _xy_overlap(q.x, q.y, q.length, q.width, p) > EPS:
            return True
    return False


def _compact(movable, placements):
    """Slide newly placed boxes toward the cab (-x) then the left wall (-y)
    until they touch something, repeated to a fixpoint. Closes the seams a
    greedy order can leave behind. Pre-existing placements are not in
    `movable`, so a persisted load is never rearranged."""
    for _ in range(3):  # fixpoint guard
        moved = False
        for p in sorted(movable, key=lambda q: (q.x, q.y)):
            if _carries_load(p, placements):
                continue
            # -x slide: stop at the nearest face on the left that overlaps in y & z
            nx = 0.0
            for q in placements:
                if q is p:
                    continue
                if (q.y < p.y + p.width - EPS and q.y + q.width > p.y + EPS
                        and q.z < p.z + p.height - EPS and q.z + q.height > p.z + EPS
                        and q.x + q.length <= p.x + EPS):
                    nx = max(nx, q.x + q.length)
            if nx < p.x - 1e-4 and (
                p.z <= EPS or _support_ratio(nx, p.y, p.z, p.length, p.width, placements, skip=p) >= SUPPORT_MIN_RATIO
            ):
                p.x = nx
                moved = True
            # -y slide likewise
            ny = 0.0
            for q in placements:
                if q is p:
                    continue
                if (q.x < p.x + p.length - EPS and q.x + q.length > p.x + EPS
                        and q.z < p.z + p.height - EPS and q.z + q.height > p.z + EPS
                        and q.y + q.width <= p.y + EPS):
                    ny = max(ny, q.y + q.width)
            if ny < p.y - 1e-4 and (
                p.z <= EPS or _support_ratio(p.x, ny, p.z, p.length, p.width, placements, skip=p) >= SUPPORT_MIN_RATIO
            ):
                p.y = ny
                moved = True
        if not moved:
            break


def _perturb(seq, strength):
    arr = list(seq)
    swaps = max(1, int(len(arr) * strength))
    for _ in range(swaps):
        i = _rng.randrange(len(arr))
        j = _rng.randrange(len(arr))
        arr[i], arr[j] = arr[j], arr[i]
    return arr


# ---------- public API ----------

def pack_boxes(container_length, container_width, container_height, boxes,
               existing_spaces=None, existing_placements=None, max_weight=None):
    """Pack `boxes` (dicts with id/length_cm/width_cm/height_cm[/weight_kg])
    into the container. `existing_placements` (list[PlacedBox] or plan-item
    dicts) makes packing incremental — new boxes are placed around the real
    current load, which itself never moves.

    Returns (placed, unplaced, free_spaces) — free_spaces is always [] now;
    kept (with the ignored `existing_spaces` argument) for call-site
    compatibility with the old guillotine engine.
    """
    tL = float(container_length)
    tW = float(container_width)
    tH = float(container_height)

    existing = []
    for item in existing_placements or []:
        if isinstance(item, PlacedBox):
            existing.append(item)
        else:
            existing.append(PlacedBox(
                box_id=str(item.get("box_id", "existing")),
                x=float(item["pos_x"]), y=float(item["pos_y"]), z=float(item["pos_z"]),
                length=float(item["placed_length_cm"]),
                width=float(item["placed_width_cm"]),
                height=float(item["placed_height_cm"]),
            ))

    base_seq = sorted(
        boxes,
        key=lambda b: float(b["length_cm"]) * float(b["width_cm"]) * float(b["height_cm"]),
        reverse=True,
    )

    # Adaptive effort: anchor scanning is O(N² · anchors), so big loads trade
    # restarts for per-restart quality (the heuristic is already strong).
    n = len(base_seq) + len(existing)
    restarts = MAX_RESTARTS if n <= 40 else 3 if n <= 90 else 1

    best_placed, best_unplaced = [], list(boxes)
    best_score = (-1, -1.0, float("-inf"))
    for restart in range(restarts):
        seq = base_seq if restart == 0 else _perturb(base_seq, SHUFFLE_STRENGTH)
        placed, unplaced = _pack_sequence(seq, tL, tW, tH, existing, max_weight)
        volume = sum(p.length * p.width * p.height for p in placed)
        everything = existing + placed
        footprint = (
            max((p.x + p.length for p in everything), default=0.0)
            + max((p.y + p.width for p in everything), default=0.0)
        )
        score = (len(placed), volume, -footprint)  # tighter footprint wins ties
        if score > best_score:
            best_score = score
            best_placed, best_unplaced = placed, unplaced
    return best_placed, best_unplaced, []


@dataclass
class ContainerCandidate:
    id: str
    code: str
    length_cm: float
    width_cm: float
    height_cm: float
    max_volume_cm3: float
    used_volume_cm3: float
    status: str


def select_best_container(candidates: list[ContainerCandidate], required_volume_cm3: float):
    """Scheduler policy (unchanged): fill partially-loaded vehicles first."""
    eligible = [
        c
        for c in candidates
        if c.status in ("available", "loading")
        and (c.max_volume_cm3 - c.used_volume_cm3) >= required_volume_cm3
    ]

    if not eligible:
        return None

    def remaining_ratio(c: ContainerCandidate):
        return (c.max_volume_cm3 - c.used_volume_cm3) / c.max_volume_cm3

    eligible.sort(key=lambda c: (remaining_ratio(c), c.max_volume_cm3))
    return eligible[0]
