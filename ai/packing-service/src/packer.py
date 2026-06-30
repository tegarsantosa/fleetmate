from dataclasses import dataclass, field


@dataclass
class Space:
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


def _orientations(length, width, height):
    return [
        (length, width, height, 0, 0, 0),
        (width, length, height, 0, 0, 90),
        (length, height, width, 90, 0, 0),
        (height, length, width, 90, 0, 90),
        (width, height, length, 0, 90, 0),
        (height, width, length, 0, 90, 90),
    ]


def _fits(space: Space, l, w, h):
    return l <= space.length + 1e-6 and w <= space.width + 1e-6 and h <= space.height + 1e-6


def _split_space(space: Space, l, w, h):
    remainders = []
    if space.length - l > 1e-6:
        remainders.append(Space(space.x + l, space.y, space.z, space.length - l, w, h))
    if space.width - w > 1e-6:
        remainders.append(Space(space.x, space.y + w, space.z, space.length, space.width - w, h))
    if space.height - h > 1e-6:
        remainders.append(Space(space.x, space.y, space.z + h, space.length, space.width, space.height - h))
    return remainders


def pack_boxes(container_length, container_width, container_height, boxes, existing_spaces=None):
    free_spaces = existing_spaces or [Space(0, 0, 0, container_length, container_width, container_height)]
    free_spaces = sorted(free_spaces, key=lambda s: s.volume, reverse=True)

    sorted_boxes = sorted(boxes, key=lambda b: b["length_cm"] * b["width_cm"] * b["height_cm"], reverse=True)

    placed: list[PlacedBox] = []
    unplaced: list[dict] = []

    for box in sorted_boxes:
        best_space_idx = None
        best_orientation = None
        best_waste = None

        for idx, space in enumerate(free_spaces):
            for l, w, h, rx, ry, rz in _orientations(
                float(box["length_cm"]), float(box["width_cm"]), float(box["height_cm"])
            ):
                if _fits(space, l, w, h):
                    waste = space.volume - (l * w * h)
                    if best_waste is None or waste < best_waste:
                        best_waste = waste
                        best_space_idx = idx
                        best_orientation = (l, w, h, rx, ry, rz)

        if best_space_idx is None:
            unplaced.append(box)
            continue

        space = free_spaces.pop(best_space_idx)
        l, w, h, rx, ry, rz = best_orientation

        placed.append(
            PlacedBox(
                box_id=box["id"],
                x=space.x,
                y=space.y,
                z=space.z,
                length=l,
                width=w,
                height=h,
                rot_x=rx,
                rot_y=ry,
                rot_z=rz,
            )
        )

        free_spaces.extend(_split_space(space, l, w, h))
        free_spaces = sorted(free_spaces, key=lambda s: s.volume, reverse=True)

    return placed, unplaced, free_spaces


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
