CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE container_status AS ENUM ('available', 'loading', 'full', 'dispatched');
CREATE TYPE packing_status AS ENUM ('pending', 'planned', 'failed');

CREATE TABLE containers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    length_cm NUMERIC NOT NULL,
    width_cm NUMERIC NOT NULL,
    height_cm NUMERIC NOT NULL,
    max_volume_cm3 NUMERIC GENERATED ALWAYS AS (length_cm * width_cm * height_cm) STORED,
    used_volume_cm3 NUMERIC NOT NULL DEFAULT 0,
    status container_status NOT NULL DEFAULT 'available',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camera_left_path TEXT,
    camera_right_path TEXT,
    raw_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE boxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
    label TEXT,
    length_cm NUMERIC NOT NULL,
    width_cm NUMERIC NOT NULL,
    height_cm NUMERIC NOT NULL,
    volume_cm3 NUMERIC GENERATED ALWAYS AS (length_cm * width_cm * height_cm) STORED,
    confidence NUMERIC NOT NULL DEFAULT 0,
    status packing_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE packing_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
    volume_utilization NUMERIC NOT NULL DEFAULT 0,
    box_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE packing_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES packing_plans(id) ON DELETE CASCADE,
    box_id UUID NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
    pos_x NUMERIC NOT NULL,
    pos_y NUMERIC NOT NULL,
    pos_z NUMERIC NOT NULL,
    rot_x INTEGER NOT NULL DEFAULT 0,
    rot_y INTEGER NOT NULL DEFAULT 0,
    rot_z INTEGER NOT NULL DEFAULT 0,
    placed_length_cm NUMERIC NOT NULL,
    placed_width_cm NUMERIC NOT NULL,
    placed_height_cm NUMERIC NOT NULL
);

CREATE INDEX idx_boxes_status ON boxes(status);
CREATE INDEX idx_packing_items_plan ON packing_items(plan_id);
CREATE INDEX idx_packing_items_box ON packing_items(box_id);

INSERT INTO containers (code, name, length_cm, width_cm, height_cm, status) VALUES
('FMATE-001', 'Mobil Pickup Box', 200, 150, 150, 'available'),
('FMATE-002', 'Mobil L300', 246, 160, 138, 'available'),
('FMATE-003', 'Truk Box Sedang', 600, 235, 239, 'available'),
('FMATE-004', 'Truk Box Fuso', 789, 245, 239, 'available');
