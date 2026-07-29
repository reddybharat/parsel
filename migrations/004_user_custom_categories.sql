-- Align users.preferences default with app defaults (theme + custom_categories).
ALTER TABLE users
    ALTER COLUMN preferences
    SET DEFAULT '{"theme":"light","custom_categories":[]}'::jsonb;
