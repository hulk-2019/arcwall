-- 画布模型字典同步（category = canvas_model，type 列区分节点类型）
-- 幂等：重复执行按 (category, key) upsert；不在清单内的画布模型置为停用。
-- 执行：psql $DATABASE_URL -f prisma/seed-canvas-models.sql

INSERT INTO dictionaries (category, key, type, label_zh, label_en, sort_order, is_active, created_at, updated_at)
VALUES
  -- 图片：Ark Seedream 系列
  ('canvas_model', 'doubao-seedream-4-5-251128',     'image', 'Seedream 4.5',        'Seedream 4.5',        1,  true, NOW(), NOW()),
  ('canvas_model', 'doubao-seedream-4-0-250828',     'image', 'Seedream 4.0',        'Seedream 4.0',        2,  true, NOW(), NOW()),
  ('canvas_model', 'doubao-seedream-3-0-t2i-250415', 'image', 'Seedream 3.0',        'Seedream 3.0',        3,  true, NOW(), NOW()),
  -- 图片：302.ai 代理（GPT-Image / Nano Banana）
  ('canvas_model', 'gpt-image-2',                    'image', 'GPT-Image-2',         'GPT-Image-2',         4,  true, NOW(), NOW()),
  ('canvas_model', 'gemini-3.1-flash-image-preview', 'image', 'Nano Banana 2',       'Nano Banana 2',       5,  true, NOW(), NOW()),
  ('canvas_model', 'gemini-3-pro-image-preview',     'image', 'Nano Banana Pro',     'Nano Banana Pro',     6,  true, NOW(), NOW()),
  -- 视频：302.ai 代理 Seedance 系列
  ('canvas_model', 'doubao-seedance-2-0-fast-260128',  'video', 'Seedance 2.0 Fast', 'Seedance 2.0 Fast', 7,  true, NOW(), NOW()),
  ('canvas_model', 'doubao-seedance-2-0-260128',       'video', 'Seedance 2.0',      'Seedance 2.0',      8,  true, NOW(), NOW()),
  ('canvas_model', 'doubao-seedance-1-0-pro-250528',   'video', 'Seedance 1.0 Pro',  'Seedance 1.0 Pro',  9,  true, NOW(), NOW()),
  ('canvas_model', 'doubao-seedance-1-0-lite-t2v-250428', 'video', 'Seedance 1.0 Lite', 'Seedance 1.0 Lite', 10, true, NOW(), NOW()),
  -- 音频：Suno 音乐生成（302.ai 代理，services/suno-proxy.ts 映射 mv 版本码）
  ('canvas_model', 'suno-v5.5',    'audio', 'Suno V5.5', 'Suno V5.5', 11, true, NOW(), NOW()),
  ('canvas_model', 'suno-v5',      'audio', 'Suno V5',   'Suno V5',   12, true, NOW(), NOW()),
  ('canvas_model', 'suno-v4.5plus','audio', 'Suno V4.5+','Suno V4.5+',13, true, NOW(), NOW()),
  ('canvas_model', 'suno-v4.5',    'audio', 'Suno V4.5', 'Suno V4.5', 14, true, NOW(), NOW()),
  ('canvas_model', 'suno-v4',      'audio', 'Suno V4',   'Suno V4',   15, true, NOW(), NOW())
ON CONFLICT (category, key) DO UPDATE
SET type = EXCLUDED.type,
    label_zh = EXCLUDED.label_zh,
    label_en = EXCLUDED.label_en,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- 同步清理：停用清单之外的画布模型（保留行以便历史引用，接口只返回 is_active）
UPDATE dictionaries
SET is_active = false,
    updated_at = NOW()
WHERE category = 'canvas_model'
  AND is_active = true
  AND key NOT IN (
    'doubao-seedream-4-5-251128',
    'doubao-seedream-4-0-250828',
    'doubao-seedream-3-0-t2i-250415',
    'gpt-image-2',
    'gemini-3.1-flash-image-preview',
    'gemini-3-pro-image-preview',
    'doubao-seedance-2-0-fast-260128',
    'doubao-seedance-2-0-260128',
    'doubao-seedance-1-0-pro-250528',
    'doubao-seedance-1-0-lite-t2v-250428',
    'suno-v5.5',
    'suno-v5',
    'suno-v4.5plus',
    'suno-v4.5',
    'suno-v4'
  );
