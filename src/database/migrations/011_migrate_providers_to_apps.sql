-- Migrate existing tenant_providers into apps with type='ticket', role='both'
INSERT INTO apps (tenant_id, code, type, role, name, credentials, webhook_secret, is_active, created_at, updated_at)
SELECT tenant_id, provider, 'ticket', 'both', provider, credentials, webhook_secret, is_active, created_at, updated_at
FROM tenant_providers;

-- Backfill input_app_id on tickets
UPDATE tickets t
SET input_app_id = a.id
FROM apps a
WHERE a.tenant_id = t.tenant_id AND a.code = t.provider;

-- Set output_app_id = input_app_id (preserves current behavior)
UPDATE tickets
SET output_app_id = input_app_id
WHERE input_app_id IS NOT NULL;

-- Drop old unique constraint and add new one
ALTER TABLE tickets DROP CONSTRAINT tickets_tenant_id_provider_external_id_key;
ALTER TABLE tickets ADD CONSTRAINT tickets_tenant_id_input_app_id_external_id_key UNIQUE (tenant_id, input_app_id, external_id);

-- Drop provider column from tickets
ALTER TABLE tickets DROP COLUMN provider;

-- Drop old tenant_providers table
DROP TABLE tenant_providers;
