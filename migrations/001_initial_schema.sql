-- SkyPanelV2 Consolidated Migration
-- Date: 2025-11-01
-- This script initializes the full schema without legacy container artifacts.

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Shared helper to maintain updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Base Schema
-- ============================================================

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    phone VARCHAR(50),
    timezone VARCHAR(100),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}',
    website VARCHAR(500),
    address TEXT,
    tax_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create organization_members table
CREATE TABLE IF NOT EXISTS organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    balance DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_api_keys table
CREATE TABLE IF NOT EXISTS user_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '{}',
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vps_instances table
CREATE TABLE IF NOT EXISTS vps_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id VARCHAR(255) NOT NULL,
    provider_instance_id VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'provisioning',
    ip_address INET,
    configuration JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(500) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    category VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create support_ticket_replies table
CREATE TABLE IF NOT EXISTS support_ticket_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_staff_reply BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create vps_plans table
CREATE TABLE IF NOT EXISTS vps_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    provider_plan_id VARCHAR(255) NOT NULL,
    cpu_cores INTEGER NOT NULL,
    memory_gb INTEGER NOT NULL,
    storage_gb INTEGER NOT NULL,
    bandwidth_gb INTEGER,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_hourly DECIMAL(10,4) NOT NULL,
    available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50) NOT NULL,
    payment_provider VARCHAR(50) NOT NULL,
    provider_transaction_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_org_id ON wallets(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_vps_instances_org_id ON vps_instances(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org_id ON support_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_by ON support_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_ticket_id ON support_ticket_replies(ticket_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_org_id ON payment_transactions(organization_id);

-- Triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_api_keys_updated_at BEFORE UPDATE ON user_api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vps_instances_updated_at BEFORE UPDATE ON vps_instances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vps_plans_updated_at BEFORE UPDATE ON vps_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default admin user and organization
DO $$
DECLARE
    admin_user_id UUID;
    admin_org_id UUID;
BEGIN
    INSERT INTO users (id, email, password_hash, name, role)
    VALUES (
        uuid_generate_v4(),
        'admin@skypanelv2.com',
        '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uO9G',
        'System Administrator',
        'admin'
    ) ON CONFLICT (email) DO NOTHING
    RETURNING id INTO admin_user_id;

    IF admin_user_id IS NULL THEN
        SELECT id INTO admin_user_id FROM users WHERE email = 'admin@skypanelv2.com';
    END IF;

    INSERT INTO organizations (id, name, slug, owner_id)
    VALUES (
        uuid_generate_v4(),
        'SkyPanelV2 Admin',
        'skypanelv2-admin',
        admin_user_id
    ) ON CONFLICT (slug) DO NOTHING
    RETURNING id INTO admin_org_id;

    IF admin_org_id IS NULL THEN
        SELECT id INTO admin_org_id FROM organizations WHERE slug = 'skypanelv2-admin';
    END IF;

    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (admin_org_id, admin_user_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    INSERT INTO wallets (organization_id, balance)
    VALUES (admin_org_id, 0.00)
    ON CONFLICT DO NOTHING;
END $$;

-- ============================================================
-- Consolidated Historical Migrations (non-container)
-- ============================================================

-- Migration 003: Align vps_plans schema and add service_providers
CREATE TABLE IF NOT EXISTS service_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('linode','digitalocean','aws','gcp')),
  api_key_encrypted TEXT NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE vps_plans
  ADD COLUMN IF NOT EXISTS provider_id UUID,
  ADD COLUMN IF NOT EXISTS base_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS markup_price NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS specifications JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'vps_plans_provider_id_fkey'
  ) THEN
    ALTER TABLE vps_plans
      ADD CONSTRAINT vps_plans_provider_id_fkey
      FOREIGN KEY (provider_id) REFERENCES service_providers(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_service_providers_updated_at'
  ) THEN
    CREATE TRIGGER update_service_providers_updated_at
    BEFORE UPDATE ON service_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_vps_plans_updated_at'
  ) THEN
    CREATE TRIGGER update_vps_plans_updated_at
    BEFORE UPDATE ON vps_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vps_plans'
      AND column_name = 'price_monthly'
  ) THEN
    UPDATE vps_plans
    SET base_price = price_monthly
    WHERE base_price IS NULL AND price_monthly IS NOT NULL;
  END IF;
END $$;

-- Migration 004: Ensure user_api_keys structure matches expectations
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'name')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'key_name') THEN
        ALTER TABLE user_api_keys
        ADD COLUMN key_name VARCHAR(255),
        ADD COLUMN key_prefix VARCHAR(255),
        ADD COLUMN active BOOLEAN DEFAULT TRUE;

        UPDATE user_api_keys SET key_name = name WHERE key_name IS NULL;
        UPDATE user_api_keys SET key_prefix = 'sk_live_...' WHERE key_prefix IS NULL;

        ALTER TABLE user_api_keys
        ALTER COLUMN key_name SET NOT NULL,
        ALTER COLUMN key_prefix SET NOT NULL;

        ALTER TABLE user_api_keys DROP COLUMN name;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'key_name') THEN
        ALTER TABLE user_api_keys ADD COLUMN key_name VARCHAR(255) NOT NULL DEFAULT '';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'key_prefix') THEN
        ALTER TABLE user_api_keys ADD COLUMN key_prefix VARCHAR(255) NOT NULL DEFAULT '';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'active') THEN
        ALTER TABLE user_api_keys ADD COLUMN active BOOLEAN DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_api_keys' AND column_name = 'updated_at') THEN
        ALTER TABLE user_api_keys ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_api_keys_active ON user_api_keys(active);

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own API keys" ON user_api_keys;
CREATE POLICY "Users can manage their own API keys" ON user_api_keys
    FOR ALL USING (user_id = current_setting('app.current_user_id', true)::UUID);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_api_keys_updated_at ON user_api_keys;
CREATE TRIGGER update_user_api_keys_updated_at
    BEFORE UPDATE ON user_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Migration 005: Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID,
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255),
  message TEXT,
  status VARCHAR(50) DEFAULT 'info' CHECK (status IN ('success', 'warning', 'error', 'info')),
  ip_address VARCHAR(64),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_id ON activity_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON activity_logs(event_type);

-- Migration 005B: Update VPS plan schema
ALTER TABLE vps_plans DROP COLUMN IF EXISTS provider;
ALTER TABLE vps_plans DROP COLUMN IF EXISTS cpu_cores;
ALTER TABLE vps_plans DROP COLUMN IF EXISTS memory_gb;
ALTER TABLE vps_plans DROP COLUMN IF EXISTS storage_gb;
ALTER TABLE vps_plans DROP COLUMN IF EXISTS bandwidth_gb;
ALTER TABLE vps_plans DROP COLUMN IF EXISTS price_monthly;
ALTER TABLE vps_plans DROP COLUMN IF EXISTS price_hourly;
ALTER TABLE vps_plans DROP COLUMN IF EXISTS available;

ALTER TABLE vps_plans ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES service_providers(id) ON DELETE CASCADE;
ALTER TABLE vps_plans ADD COLUMN IF NOT EXISTS base_price DECIMAL(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE vps_plans ADD COLUMN IF NOT EXISTS markup_price DECIMAL(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE vps_plans ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}';
ALTER TABLE vps_plans ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_vps_plans_provider_id ON vps_plans(provider_id);
CREATE INDEX IF NOT EXISTS idx_vps_plans_active ON vps_plans(active);

-- Migration 006A: Billing tracking
CREATE TABLE IF NOT EXISTS vps_billing_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vps_instance_id UUID NOT NULL REFERENCES vps_instances(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  hourly_rate DECIMAL(10,4) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'billed', 'failed', 'refunded')),
  payment_transaction_id UUID REFERENCES payment_transactions(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vps_billing_cycles_vps_id ON vps_billing_cycles(vps_instance_id);
CREATE INDEX IF NOT EXISTS idx_vps_billing_cycles_org_id ON vps_billing_cycles(organization_id);
CREATE INDEX IF NOT EXISTS idx_vps_billing_cycles_period ON vps_billing_cycles(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_vps_billing_cycles_status ON vps_billing_cycles(status);
CREATE INDEX IF NOT EXISTS idx_vps_billing_cycles_created_at ON vps_billing_cycles(created_at);

CREATE TRIGGER update_vps_billing_cycles_updated_at
BEFORE UPDATE ON vps_billing_cycles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE vps_instances
ADD COLUMN IF NOT EXISTS last_billed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_vps_instances_last_billed_at ON vps_instances(last_billed_at);

-- Migration 006B: Stackscript configs
CREATE TABLE IF NOT EXISTS vps_stackscript_configs (
  stackscript_id INTEGER PRIMARY KEY,
  label TEXT,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vps_stackscript_configs_enabled ON vps_stackscript_configs(is_enabled);
CREATE INDEX IF NOT EXISTS idx_vps_stackscript_configs_order ON vps_stackscript_configs(display_order);

-- Migration 007: Networking config
CREATE TABLE IF NOT EXISTS networking_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rdns_base_domain TEXT NOT NULL DEFAULT 'ip.rev.skyvps360.xyz',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_networking_config_updated_at'
  ) THEN
    CREATE TRIGGER update_networking_config_updated_at
    BEFORE UPDATE ON networking_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Migration 008: Notifications enhancement
ALTER TABLE activity_logs
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_activity_logs_is_read ON activity_logs(user_id, is_read, created_at DESC);

CREATE OR REPLACE FUNCTION notify_new_activity()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'new_activity',
    json_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'organization_id', NEW.organization_id,
      'event_type', NEW.event_type,
      'entity_type', NEW.entity_type,
      'entity_id', NEW.entity_id,
      'message', NEW.message,
      'status', NEW.status,
      'created_at', NEW.created_at,
      'is_read', NEW.is_read
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_notify_trigger ON activity_logs;
CREATE TRIGGER activity_notify_trigger
  AFTER INSERT ON activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_activity();

CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID, user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE activity_logs
  SET is_read = TRUE, read_at = NOW()
  WHERE id = notification_id AND user_id = user_id_param AND is_read = FALSE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mark_all_notifications_read(user_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE activity_logs
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = user_id_param AND is_read = FALSE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Migration 009A: Notification filtering
CREATE OR REPLACE FUNCTION notify_new_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.event_type IN (
    'vps.create', 'vps.boot', 'vps.shutdown', 'vps.reboot', 'vps.delete',
    'vps.backups.enable', 'vps.backups.disable', 'vps.backups.schedule',
    'vps.backups.snapshot', 'vps.backups.restore',
    'vps.firewall.attach', 'vps.firewall.detach',
    'vps.network.rdns', 'vps.hostname.update',
    'auth.login',
    'api_key.create', 'api_key.revoke',
    'ticket_reply',
    'user_update'
  ) THEN
    PERFORM pg_notify(
      'new_activity',
      json_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'organization_id', NEW.organization_id,
        'event_type', NEW.event_type,
        'entity_type', NEW.entity_type,
        'entity_id', NEW.entity_id,
        'message', NEW.message,
        'status', NEW.status,
        'created_at', NEW.created_at,
        'is_read', NEW.is_read
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION notify_new_activity() IS
'Sends real-time notifications only for user-relevant events. Excludes system events like rate_limit_violation, rate_limit_config, admin_operation, impersonation events, auth.logout, and theme_update to prevent notification spam.';

-- Migration 009B: Support ticket chat features
ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS has_staff_reply BOOLEAN DEFAULT FALSE;

UPDATE support_tickets st
SET has_staff_reply = TRUE
WHERE EXISTS (
    SELECT 1 FROM support_ticket_replies str
    WHERE str.ticket_id = st.id AND str.is_staff_reply = TRUE
);

CREATE OR REPLACE FUNCTION notify_new_ticket_message()
RETURNS TRIGGER AS $$
DECLARE
    ticket_org_id UUID;
    payload JSON;
BEGIN
    SELECT organization_id INTO ticket_org_id
    FROM support_tickets
    WHERE id = NEW.ticket_id;

    payload := json_build_object(
        'type', 'ticket_message',
        'ticket_id', NEW.ticket_id,
        'message_id', NEW.id,
        'organization_id', ticket_org_id,
        'is_staff_reply', NEW.is_staff_reply,
        'message', NEW.message,
        'created_at', NEW.created_at
    );

    PERFORM pg_notify('ticket_' || NEW.ticket_id::text, payload::text);
    PERFORM pg_notify('org_tickets_' || ticket_org_id::text, payload::text);

    IF NEW.is_staff_reply = TRUE THEN
        UPDATE support_tickets
        SET has_staff_reply = TRUE
        WHERE id = NEW.ticket_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_ticket_message ON support_ticket_replies;
CREATE TRIGGER trigger_notify_ticket_message
    AFTER INSERT ON support_ticket_replies
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_ticket_message();

CREATE OR REPLACE FUNCTION notify_ticket_status_change()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        payload := json_build_object(
            'type', 'ticket_status_change',
            'ticket_id', NEW.id,
            'organization_id', NEW.organization_id,
            'old_status', OLD.status,
            'new_status', NEW.status,
            'updated_at', NEW.updated_at
        );

        PERFORM pg_notify('ticket_' || NEW.id::text, payload::text);
        PERFORM pg_notify('org_tickets_' || NEW.organization_id::text, payload::text);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_ticket_status ON support_tickets;
CREATE TRIGGER trigger_notify_ticket_status
    AFTER UPDATE ON support_tickets
    FOR EACH ROW
    EXECUTE FUNCTION notify_ticket_status_change();

CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_created_at ON support_ticket_replies(created_at);
CREATE INDEX IF NOT EXISTS idx_support_tickets_has_staff_reply ON support_tickets(has_staff_reply);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

COMMENT ON COLUMN support_tickets.has_staff_reply IS 'Indicates whether at least one staff member has replied to this ticket. Users can only close tickets after receiving a staff reply.';

-- Migration 010: Theme settings storage
CREATE TABLE IF NOT EXISTS platform_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_platform_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON platform_settings
FOR EACH ROW
EXECUTE FUNCTION update_platform_settings_updated_at();

INSERT INTO platform_settings (key, value)
VALUES ('theme', jsonb_build_object('presetId', 'teal'))
ON CONFLICT (key) DO NOTHING;

-- Migration 011: Password reset columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token)
WHERE reset_token IS NOT NULL;

-- Migration 012: FAQ management (container references removed)
CREATE TABLE IF NOT EXISTS faq_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faq_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES faq_categories(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS faq_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    published_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faq_categories_display_order ON faq_categories(display_order);
CREATE INDEX IF NOT EXISTS idx_faq_categories_active ON faq_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_faq_items_category_id ON faq_items(category_id);
CREATE INDEX IF NOT EXISTS idx_faq_items_display_order ON faq_items(display_order);
CREATE INDEX IF NOT EXISTS idx_faq_items_active ON faq_items(is_active);
CREATE INDEX IF NOT EXISTS idx_faq_updates_published_date ON faq_updates(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_faq_updates_display_order ON faq_updates(display_order);
CREATE INDEX IF NOT EXISTS idx_faq_updates_active ON faq_updates(is_active);

CREATE TRIGGER update_faq_categories_updated_at
BEFORE UPDATE ON faq_categories
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_faq_items_updated_at
BEFORE UPDATE ON faq_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_faq_updates_updated_at
BEFORE UPDATE ON faq_updates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO faq_categories (name, description, display_order, is_active) VALUES
('Getting Started', 'Essential information for new users', 0, TRUE),
('VPS Hosting', 'Virtual Private Server hosting questions', 1, TRUE),
('Billing & Payments', 'Payment methods and billing information', 2, TRUE),
('Support', 'How to get help and contact support', 3, TRUE),
('Technical', 'Technical specifications and capabilities', 4, TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'What is SkyPanelV2?',
    'SkyPanelV2 is a cloud infrastructure platform that provides VPS hosting, dedicated servers, and managed services. We offer flexible, scalable solutions for businesses of all sizes.',
    0,
    TRUE
FROM faq_categories WHERE name = 'Getting Started'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'How do I create an account?',
    'Click the ''Register'' button at the top right of the page. Fill in your email, create a password, and verify your email address. Once verified, you can start deploying services immediately.',
    1,
    TRUE
FROM faq_categories WHERE name = 'Getting Started'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'What payment methods do you accept?',
    'We accept PayPal for wallet top-ups. You can add funds to your wallet using credit/debit cards through PayPal''s secure payment gateway.',
    2,
    TRUE
FROM faq_categories WHERE name = 'Getting Started'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'How does billing work?',
    'We use an hourly billing model. Resources are billed every hour based on usage. Charges are automatically deducted from your prepaid wallet balance.',
    3,
    TRUE
FROM faq_categories WHERE name = 'Getting Started'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'What is a VPS?',
    'A Virtual Private Server (VPS) is a virtualized server that provides dedicated resources (CPU, RAM, storage) in a shared hosting environment. It gives you full root access and control over your server.',
    0,
    TRUE
FROM faq_categories WHERE name = 'VPS Hosting'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'What operating systems are available?',
    'We offer a wide range of Linux distributions including Ubuntu, Debian, CentOS, Fedora, and more. You can also deploy custom images or use marketplace applications.',
    1,
    TRUE
FROM faq_categories WHERE name = 'VPS Hosting'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'Can I upgrade or downgrade my VPS?',
    'Yes! You can resize your VPS at any time. Upgrades happen quickly, while downgrades may require some downtime for disk reduction.',
    2,
    TRUE
FROM faq_categories WHERE name = 'VPS Hosting'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'Do you provide backups?',
    'Yes, we offer automated daily backups and manual snapshots. You can enable backups for any VPS instance and restore from any backup point.',
    3,
    TRUE
FROM faq_categories WHERE name = 'VPS Hosting'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'How do I add funds to my wallet?',
    'Go to the Billing section and click ''Add Funds''. Enter the amount you want to add and complete the payment through PayPal.',
    0,
    TRUE
FROM faq_categories WHERE name = 'Billing & Payments'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'Can I get a refund?',
    'We offer prorated refunds for unused services. Contact our support team to request a refund, and we''ll process it within 5-7 business days.',
    1,
    TRUE
FROM faq_categories WHERE name = 'Billing & Payments'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'What happens if my wallet runs out of funds?',
    'You''ll receive email notifications when your balance is low. If your wallet reaches zero, your services will be suspended until you add more funds.',
    2,
    TRUE
FROM faq_categories WHERE name = 'Billing & Payments'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'Can I set up auto-reload?',
    'Currently, auto-reload is not available, but it''s on our roadmap. You''ll need to manually add funds as needed.',
    3,
    TRUE
FROM faq_categories WHERE name = 'Billing & Payments'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'How do I contact support?',
    'You can create a support ticket from your dashboard. We typically respond within 24 hours for regular tickets and within 4 hours for urgent issues.',
    0,
    TRUE
FROM faq_categories WHERE name = 'Support'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'Do you offer live chat support?',
    'Currently, support is provided through our ticketing system. Live chat support is planned for future releases.',
    1,
    TRUE
FROM faq_categories WHERE name = 'Support'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'What are your support hours?',
    'Our support team is available 24/7 for critical issues. Regular tickets are handled during business hours (9 AM - 6 PM EST).',
    2,
    TRUE
FROM faq_categories WHERE name = 'Support'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'What data centers do you use?',
    'We partner with leading infrastructure providers including Linode/Akamai, DigitalOcean, and ReliableSite. Servers are available in multiple regions worldwide including North America, Europe, and Asia.',
    0,
    TRUE
FROM faq_categories WHERE name = 'Technical'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'Do you provide DDoS protection?',
    'Yes, all our services include basic DDoS protection. Advanced DDoS mitigation is available as an add-on.',
    1,
    TRUE
FROM faq_categories WHERE name = 'Technical'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'Can I use my own domain?',
    'Yes! You can point your domain to your VPS using A/AAAA records. We also support custom reverse DNS.',
    2,
    TRUE
FROM faq_categories WHERE name = 'Technical'
ON CONFLICT DO NOTHING;

INSERT INTO faq_items (category_id, question, answer, display_order, is_active)
SELECT
    id,
    'Is there an API available?',
    'Yes, we provide a comprehensive RESTful API. You can generate API keys from your account settings and integrate with our platform programmatically.',
    3,
    TRUE
FROM faq_categories WHERE name = 'Technical'
ON CONFLICT DO NOTHING;

INSERT INTO faq_updates (title, description, published_date, display_order, is_active) VALUES
('New API endpoints for theme controls', 'Automate theme presets and dynamic branding from your CI/CD pipeline.', NOW() - INTERVAL '7 days', 0, TRUE),
('Status page redesign', 'Real-time health metrics with region-level granularity and historical uptime.', NOW() - INTERVAL '14 days', 1, TRUE),
('Improved billing transparency', 'Hourly usage charts and wallet alerts keep your finance team in sync.', NOW() - INTERVAL '21 days', 2, TRUE)
ON CONFLICT DO NOTHING;

-- Migration 013: Contact management
CREATE TABLE IF NOT EXISTS contact_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label VARCHAR(255) NOT NULL,
    value VARCHAR(255) NOT NULL UNIQUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    method_type VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_of_week VARCHAR(20) NOT NULL UNIQUE,
    is_open BOOLEAN DEFAULT TRUE,
    hours_text VARCHAR(255),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_categories_display_order ON contact_categories(display_order);
CREATE INDEX IF NOT EXISTS idx_contact_categories_active ON contact_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_contact_categories_value ON contact_categories(value);
CREATE INDEX IF NOT EXISTS idx_contact_methods_type ON contact_methods(method_type);
CREATE INDEX IF NOT EXISTS idx_contact_methods_active ON contact_methods(is_active);
CREATE INDEX IF NOT EXISTS idx_platform_availability_display_order ON platform_availability(display_order);

CREATE TRIGGER update_contact_categories_updated_at
BEFORE UPDATE ON contact_categories
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_methods_updated_at
BEFORE UPDATE ON contact_methods
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_availability_updated_at
BEFORE UPDATE ON platform_availability
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO contact_categories (label, value, display_order, is_active) VALUES
('General inquiry', 'general', 0, TRUE),
('Pricing & sales', 'sales', 1, TRUE),
('Technical support', 'support', 2, TRUE),
('Billing', 'billing', 3, TRUE),
('Partnership', 'partnership', 4, TRUE),
('Other', 'other', 5, TRUE)
ON CONFLICT (value) DO NOTHING;

INSERT INTO contact_methods (method_type, title, description, is_active, config) VALUES
(
    'email',
    'Email our team',
    'For general questions and account help',
    TRUE,
    jsonb_build_object(
        'email_address', 'support@skypanelv2.com',
        'response_time', 'We reply within one business day.'
    )
)
ON CONFLICT (method_type) DO NOTHING;

INSERT INTO contact_methods (method_type, title, description, is_active, config) VALUES
(
    'ticket',
    'Submit a ticket',
    'Technical issues, platform feedback, or outages',
    TRUE,
    jsonb_build_object(
        'dashboard_link', '/support',
        'priority_queues', jsonb_build_array(
            jsonb_build_object(
                'label', 'P1: Production outage',
                'response_time', '15 min response'
            ),
            jsonb_build_object(
                'label', 'P2: Degraded performance',
                'response_time', '1 hr response'
            )
        )
    )
)
ON CONFLICT (method_type) DO NOTHING;

INSERT INTO contact_methods (method_type, title, description, is_active, config) VALUES
(
    'phone',
    'Call us',
    'Weekdays 9:00 AM – 6:00 PM EST',
    TRUE,
    jsonb_build_object(
        'phone_number', '+1 (234) 567-890',
        'availability_text', 'Emergency support available 24/7 for enterprise plans.'
    )
)
ON CONFLICT (method_type) DO NOTHING;

INSERT INTO contact_methods (method_type, title, description, is_active, config) VALUES
(
    'office',
    'Visit our office',
    'By appointment only',
    TRUE,
    jsonb_build_object(
        'address_line1', '123 Cloud Street',
        'address_line2', 'Tech District',
        'city', 'San Francisco',
        'state', 'CA',
        'postal_code', '94105',
        'country', 'United States',
        'appointment_required', 'By appointment only'
    )
)
ON CONFLICT (method_type) DO NOTHING;

INSERT INTO platform_availability (day_of_week, is_open, hours_text, display_order) VALUES
('monday', TRUE, '9:00 AM – 6:00 PM EST', 0),
('tuesday', TRUE, '9:00 AM – 6:00 PM EST', 1),
('wednesday', TRUE, '9:00 AM – 6:00 PM EST', 2),
('thursday', TRUE, '9:00 AM – 6:00 PM EST', 3),
('friday', TRUE, '9:00 AM – 6:00 PM EST', 4),
('saturday', TRUE, '10:00 AM – 4:00 PM EST', 5),
('sunday', FALSE, 'Closed', 6)
ON CONFLICT (day_of_week) DO NOTHING;

INSERT INTO platform_settings (key, value) VALUES
(
    'emergency_support_text',
    jsonb_build_object(
        'text', 'Emergency support: Available 24/7 for customers with enterprise SLAs.'
    )
)
ON CONFLICT (key) DO NOTHING;

-- Migration 014: DigitalOcean provider support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'service_providers'
  ) THEN
    RAISE EXCEPTION 'service_providers table does not exist. Please ensure earlier schema is applied.';
  END IF;
END $$;

ALTER TABLE service_providers DROP CONSTRAINT IF EXISTS service_providers_type_check;

ALTER TABLE service_providers
  ADD CONSTRAINT service_providers_type_check
  CHECK (type IN ('linode', 'digitalocean', 'aws', 'gcp'));

CREATE TABLE IF NOT EXISTS provider_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  metadata_key VARCHAR(255) NOT NULL,
  metadata_value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id, metadata_key)
);

CREATE INDEX IF NOT EXISTS idx_provider_metadata_provider_id ON provider_metadata(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_metadata_key ON provider_metadata(metadata_key);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_provider_metadata_updated_at'
  ) THEN
    CREATE TRIGGER update_provider_metadata_updated_at
    BEFORE UPDATE ON provider_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vps_instances'
      AND column_name = 'provider_type'
  ) THEN
    ALTER TABLE vps_instances ADD COLUMN provider_type VARCHAR(50);
    CREATE INDEX IF NOT EXISTS idx_vps_instances_provider_type ON vps_instances(provider_type);
  END IF;
END $$;

COMMENT ON TABLE provider_metadata IS 'Stores provider-specific metadata and configuration';
COMMENT ON COLUMN service_providers.type IS 'Provider type: linode, digitalocean, aws, gcp';
COMMENT ON COLUMN vps_instances.provider_type IS 'Cached provider type for quick filtering';

INSERT INTO service_providers (name, type, api_key_encrypted, configuration, active)
SELECT 'DigitalOcean', 'digitalocean', '', '{}', false
WHERE NOT EXISTS (
  SELECT 1 FROM service_providers WHERE type = 'digitalocean'
);

-- Migration 015: Activity log system events
ALTER TABLE activity_logs ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_user_or_system_check
CHECK (
  user_id IS NOT NULL OR
  (user_id IS NULL AND entity_type = 'system')
);

COMMENT ON COLUMN activity_logs.user_id IS 'User ID for user events, NULL for system events';
COMMENT ON CONSTRAINT activity_logs_user_or_system_check ON activity_logs IS 'Ensures user_id is provided for user events, or NULL for system events only';

-- Migration 016: provider_id on vps_instances
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vps_instances'
      AND column_name = 'provider_id'
  ) THEN
    ALTER TABLE vps_instances
      ADD COLUMN provider_id UUID REFERENCES service_providers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vps_instances_provider_id ON vps_instances(provider_id);

DO $$
DECLARE
  linode_provider_id UUID;
BEGIN
  SELECT id INTO linode_provider_id
  FROM service_providers
  WHERE type = 'linode'
  LIMIT 1;

  IF linode_provider_id IS NOT NULL THEN
    UPDATE vps_instances
    SET provider_id = linode_provider_id
    WHERE provider_type = 'linode'
      AND provider_id IS NULL;

    UPDATE vps_instances
    SET provider_id = linode_provider_id,
        provider_type = 'linode'
    WHERE provider_type IS NULL
      AND provider_id IS NULL;
  END IF;
END $$;

COMMENT ON COLUMN vps_instances.provider_id IS 'Foreign key reference to service_providers table for direct provider lookup';

-- Migration 017: Provider display order
ALTER TABLE service_providers
  ADD COLUMN IF NOT EXISTS display_order INTEGER;

UPDATE service_providers
SET display_order = subquery.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS row_num
  FROM service_providers
) AS subquery
WHERE service_providers.id = subquery.id;

ALTER TABLE service_providers
  ALTER COLUMN display_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_providers_display_order ON service_providers(display_order);

-- Migration 018: User SSH keys
CREATE TABLE IF NOT EXISTS user_ssh_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  public_key TEXT NOT NULL,
  fingerprint VARCHAR(255) NOT NULL,
  linode_key_id VARCHAR(50),
  digitalocean_key_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_fingerprint UNIQUE(user_id, fingerprint)
);

CREATE INDEX idx_user_ssh_keys_user_id ON user_ssh_keys(user_id);
CREATE INDEX idx_user_ssh_keys_fingerprint ON user_ssh_keys(fingerprint);

COMMENT ON TABLE user_ssh_keys IS 'Stores SSH keys per user with provider-specific IDs for Linode and DigitalOcean';
COMMENT ON COLUMN user_ssh_keys.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN user_ssh_keys.name IS 'User-friendly name for the SSH key';
COMMENT ON COLUMN user_ssh_keys.public_key IS 'The SSH public key content';
COMMENT ON COLUMN user_ssh_keys.fingerprint IS 'SSH key fingerprint for uniqueness validation';
COMMENT ON COLUMN user_ssh_keys.linode_key_id IS 'Linode provider key ID (nullable if sync fails)';
COMMENT ON COLUMN user_ssh_keys.digitalocean_key_id IS 'DigitalOcean provider key ID (nullable if sync fails)';
COMMENT ON COLUMN user_ssh_keys.created_at IS 'Timestamp when the key was created';
COMMENT ON COLUMN user_ssh_keys.updated_at IS 'Timestamp when the key was last updated';

-- Migration 019: Backup pricing fields
ALTER TABLE vps_plans
ADD COLUMN IF NOT EXISTS backup_price_monthly DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS backup_price_hourly DECIMAL(10,6) DEFAULT 0;

COMMENT ON COLUMN vps_plans.backup_price_monthly IS 'Monthly backup price for this plan (USD)';
COMMENT ON COLUMN vps_plans.backup_price_hourly IS 'Hourly backup price for this plan (USD)';

-- Migration 020: Flexible backup pricing
ALTER TABLE vps_plans
ADD COLUMN IF NOT EXISTS daily_backups_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS weekly_backups_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS backup_upcharge_monthly DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS backup_upcharge_hourly DECIMAL(10,6) DEFAULT 0;

ALTER TABLE vps_instances
ADD COLUMN IF NOT EXISTS backup_frequency VARCHAR(20) DEFAULT 'weekly'
  CHECK (backup_frequency IN ('daily', 'weekly', 'none'));

COMMENT ON COLUMN vps_plans.daily_backups_enabled IS 'Whether daily backups are available for this plan (DigitalOcean only)';
COMMENT ON COLUMN vps_plans.weekly_backups_enabled IS 'Whether weekly backups are available for this plan';
COMMENT ON COLUMN vps_plans.backup_upcharge_monthly IS 'Admin markup on backup pricing (monthly, USD)';
COMMENT ON COLUMN vps_plans.backup_upcharge_hourly IS 'Admin markup on backup pricing (hourly, USD)';
COMMENT ON COLUMN vps_instances.backup_frequency IS 'Selected backup frequency: daily, weekly, or none';

UPDATE vps_plans
SET weekly_backups_enabled = true
WHERE weekly_backups_enabled IS NULL;

UPDATE vps_plans
SET daily_backups_enabled = false
WHERE provider_id IN (
  SELECT id FROM service_providers WHERE type = 'linode'
);

UPDATE vps_plans
SET backup_upcharge_monthly = 0,
    backup_upcharge_hourly = 0
WHERE backup_upcharge_monthly IS NULL;

UPDATE vps_instances
SET backup_frequency = 'weekly'
WHERE configuration::jsonb->>'backups_enabled' = 'true'
  AND backup_frequency IS NULL;

UPDATE vps_instances
SET backup_frequency = 'none'
WHERE (configuration::jsonb->>'backups_enabled' = 'false' OR configuration::jsonb->>'backups_enabled' IS NULL)
  AND backup_frequency IS NULL;

-- Migration 021: Allowed regions on providers
ALTER TABLE service_providers
ADD COLUMN IF NOT EXISTS allowed_regions JSONB NOT NULL DEFAULT '[]';

UPDATE service_providers
SET allowed_regions = '[
  "us-east", "us-west", "us-central", "us-southeast",
  "eu-west", "eu-central", "ap-south", "ap-southeast",
  "ap-northeast", "ca-central"
]'::jsonb
WHERE type = 'linode' AND allowed_regions = '[]'::jsonb;

UPDATE service_providers
SET allowed_regions = '[
  "nyc1", "nyc3", "ams3", "sfo3", "sgp1", "lon1",
  "fra1", "tor1", "blr1", "syd1"
]'::jsonb
WHERE type = 'digitalocean' AND allowed_regions = '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_service_providers_allowed_regions
ON service_providers USING GIN (allowed_regions);

-- Migration 022: Admin region controls
CREATE TABLE IF NOT EXISTS provider_region_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  region TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT provider_region_overrides_unique UNIQUE (provider_id, region)
);

CREATE INDEX IF NOT EXISTS idx_provider_region_overrides_provider_id
  ON provider_region_overrides(provider_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_provider_region_overrides_updated_at'
  ) THEN
    CREATE TRIGGER update_provider_region_overrides_updated_at
      BEFORE UPDATE ON provider_region_overrides
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

INSERT INTO provider_region_overrides (provider_id, region)
SELECT
  sp.id,
  LOWER(TRIM(region_value))
FROM service_providers sp
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(sp.allowed_regions, '[]'::jsonb)) AS region_value
WHERE jsonb_array_length(COALESCE(sp.allowed_regions, '[]'::jsonb)) > 0
  AND sp.type IN ('linode', 'digitalocean')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE provider_region_overrides IS 'Stores admin-defined region allowlists per infrastructure provider.';
COMMENT ON COLUMN provider_region_overrides.region IS 'Normalized provider region identifier (slug).';

-- Migration 023: Marketplace controls
ALTER TABLE service_providers
ADD COLUMN IF NOT EXISTS allowed_marketplace_apps JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS provider_marketplace_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  app_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT provider_marketplace_overrides_unique UNIQUE (provider_id, app_slug)
);

CREATE INDEX IF NOT EXISTS idx_provider_marketplace_overrides_provider_id
  ON provider_marketplace_overrides(provider_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_provider_marketplace_overrides_updated_at'
  ) THEN
    CREATE TRIGGER update_provider_marketplace_overrides_updated_at
      BEFORE UPDATE ON provider_marketplace_overrides
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE provider_marketplace_overrides IS 'Stores admin-defined allowlist of provider marketplace applications.';
COMMENT ON COLUMN provider_marketplace_overrides.app_slug IS 'DigitalOcean marketplace slug (normalized to lowercase).';

-- Migration 024: Marketplace app labels
CREATE TABLE IF NOT EXISTS provider_marketplace_labels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  app_slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT provider_marketplace_labels_unique UNIQUE (provider_id, app_slug)
);

CREATE INDEX IF NOT EXISTS idx_provider_marketplace_labels_provider_id
  ON provider_marketplace_labels(provider_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_provider_marketplace_labels_updated_at'
  ) THEN
    CREATE TRIGGER update_provider_marketplace_labels_updated_at
      BEFORE UPDATE ON provider_marketplace_labels
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE provider_marketplace_labels IS 'Stores local display-name overrides for provider marketplace applications.';
COMMENT ON COLUMN provider_marketplace_labels.display_name IS 'Admin-defined display label applied within the SkyPanel UI.';

-- Migration 025: User rate limit overrides
CREATE TABLE IF NOT EXISTS user_rate_limit_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    max_requests INTEGER NOT NULL CHECK (max_requests > 0),
    window_ms INTEGER NOT NULL CHECK (window_ms > 0),
    reason TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT user_rate_limit_overrides_unique_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_rate_limit_overrides_expires_at
    ON user_rate_limit_overrides (expires_at);

CREATE INDEX IF NOT EXISTS idx_user_rate_limit_overrides_created_by
    ON user_rate_limit_overrides (created_by);

CREATE TRIGGER update_user_rate_limit_overrides_updated_at
BEFORE UPDATE ON user_rate_limit_overrides
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
