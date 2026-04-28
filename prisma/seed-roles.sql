INSERT INTO roles (name, code, description)
VALUES (
  'Super Admin',
  'superadmin',
  'Super Administrator with full access'
)
ON CONFLICT (code)
DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Insert or update Ordinary User role
INSERT INTO roles (name, code, description)
VALUES (
  'Ordinary User',
  'user',
  'Standard user with limited access'
)
ON CONFLICT (code)
DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;