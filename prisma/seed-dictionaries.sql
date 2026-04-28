-- Insert model dictionaries
INSERT INTO dictionaries (category, key, label_en, label_zh, sort_order, is_active, created_at, updated_at)
VALUES
  ('model', 'doubao-seedream-4-0-250828', 'Doubao Seedream 4.0', 'Doubao Seedream 4.0', 1, true, NOW(), NOW())
ON CONFLICT (category, key) DO UPDATE
SET label_en = EXCLUDED.label_en,
    label_zh = EXCLUDED.label_zh,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Insert aspect ratio dictionaries
INSERT INTO dictionaries (category, key, label_en, label_zh, sort_order, is_active, created_at, updated_at)
VALUES
  ('aspect_ratio', '16:9', '16:9', '16:9', 1, true, NOW(), NOW()),
  ('aspect_ratio', '4:3', '4:3', '4:3', 2, true, NOW(), NOW()),
  ('aspect_ratio', '1:1', '1:1', '1:1', 3, true, NOW(), NOW()),
  ('aspect_ratio', '9:16', '9:16', '9:16', 4, true, NOW(), NOW())
ON CONFLICT (category, key) DO UPDATE
SET label_en = EXCLUDED.label_en,
    label_zh = EXCLUDED.label_zh,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
