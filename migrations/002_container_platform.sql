-- Container Platform Migration
-- Date: 2025-11-11
-- This migration adds all tables required for the Container-as-a-Service platform

-- ============================================================
-- Container Workers Table
-- ============================================================

CREATE TABLE IF NOT EXISTS container_workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  hostname VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  swarm_node_id VARCHAR(255) UNIQUE,
  auth_token_hash VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'unhealthy', 'draining', 'offline')),
  capacity JSONB NOT NULL DEFAULT '{"cpu_cores": 0, "memory_mb": 0, "disk_gb": 0}',
  current_load JSONB NOT NULL DEFAULT '{"cpu_percent": 0, "memory_percent": 0, "disk_percent": 0, "container_count": 0}',
  last_heartbeat_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Application Templates Table
-- ============================================================

CREATE TABLE IF NOT EXISTS application_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL CHECK (category IN ('web', 'api', 'worker', 'database', 'static', 'custom')),
  icon_url VARCHAR(500),
  nix_expression TEXT NOT NULL,
  default_env_vars JSONB DEFAULT '{}',
  default_resource_limits JSONB NOT NULL DEFAULT '{"cpu_cores": 1, "memory_mb": 512, "disk_gb": 10}',
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  is_multi_service BOOLEAN DEFAULT FALSE,
  services JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Container Services Table
-- ============================================================

CREATE TABLE IF NOT EXISTS container_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  template_id UUID REFERENCES application_templates(id) ON DELETE SET NULL,
  git_repository VARCHAR(500),
  git_branch VARCHAR(255) DEFAULT 'main',
  build_config JSONB NOT NULL DEFAULT '{"environment_type": "nix"}',
  environment_vars JSONB DEFAULT '{}',
  resource_limits JSONB NOT NULL DEFAULT '{"cpu_cores": 1, "memory_mb": 512, "disk_gb": 10}',
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'deploying', 'running', 'stopped', 'failed', 'deleted')),
  current_deployment_id UUID,
  public_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

-- ============================================================
-- Container Deployments Table
-- ============================================================

CREATE TABLE IF NOT EXISTS container_deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES container_services(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES container_workers(id) ON DELETE SET NULL,
  swarm_service_id VARCHAR(255),
  container_id VARCHAR(255),
  image_tag VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'deploying', 'running', 'stopped', 'failed', 'rolled_back')),
  build_logs TEXT,
  deployment_logs TEXT,
  public_url VARCHAR(500),
  internal_port INTEGER,
  external_port INTEGER,
  deployed_at TIMESTAMP WITH TIME ZONE,
  stopped_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint for current_deployment_id after container_deployments table exists
ALTER TABLE container_services 
  ADD CONSTRAINT fk_current_deployment 
  FOREIGN KEY (current_deployment_id) 
  REFERENCES container_deployments(id) 
  ON DELETE SET NULL;

-- ============================================================
-- Container Builds Table
-- ============================================================

CREATE TABLE IF NOT EXISTS container_builds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES container_services(id) ON DELETE CASCADE,
  deployment_id UUID REFERENCES container_deployments(id) ON DELETE SET NULL,
  git_commit_sha VARCHAR(255),
  build_status VARCHAR(50) DEFAULT 'pending' CHECK (build_status IN ('pending', 'building', 'success', 'failed', 'cancelled')),
  build_logs TEXT,
  image_tag VARCHAR(255),
  build_duration_seconds INTEGER,
  artifact_size_mb DECIMAL(10,2),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Container Secrets Table
-- ============================================================

CREATE TABLE IF NOT EXISTS container_secrets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  encrypted_value TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  last_rotated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- ============================================================
-- Container Service Secrets Junction Table
-- ============================================================

CREATE TABLE IF NOT EXISTS container_service_secrets (
  service_id UUID NOT NULL REFERENCES container_services(id) ON DELETE CASCADE,
  secret_id UUID NOT NULL REFERENCES container_secrets(id) ON DELETE CASCADE,
  mount_path VARCHAR(500),
  env_var_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (service_id, secret_id)
);

-- ============================================================
-- Container Billing Cycles Table
-- ============================================================

CREATE TABLE IF NOT EXISTS container_billing_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES container_services(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cpu_hours DECIMAL(10,2) NOT NULL,
  memory_gb_hours DECIMAL(10,2) NOT NULL,
  storage_gb_hours DECIMAL(10,2) NOT NULL,
  network_gb DECIMAL(10,4) NOT NULL,
  build_minutes INTEGER DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'billed', 'failed', 'refunded')),
  payment_transaction_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for payment_transaction_id if payment_transactions table exists
-- This will be added after verifying the table exists in the initial schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_transactions') THEN
    ALTER TABLE container_billing_cycles 
      ADD CONSTRAINT fk_payment_transaction 
      FOREIGN KEY (payment_transaction_id) 
      REFERENCES payment_transactions(id) 
      ON DELETE SET NULL;
  END IF;
END $$;


-- ============================================================
-- Performance Indexes
-- ============================================================

-- Container Workers Indexes
CREATE INDEX IF NOT EXISTS idx_container_workers_status ON container_workers(status);
CREATE INDEX IF NOT EXISTS idx_container_workers_last_heartbeat ON container_workers(last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_container_workers_swarm_node ON container_workers(swarm_node_id);

-- Application Templates Indexes
CREATE INDEX IF NOT EXISTS idx_application_templates_category ON application_templates(category);
CREATE INDEX IF NOT EXISTS idx_application_templates_active ON application_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_application_templates_display_order ON application_templates(display_order);

-- Container Services Indexes
CREATE INDEX IF NOT EXISTS idx_container_services_org ON container_services(organization_id);
CREATE INDEX IF NOT EXISTS idx_container_services_status ON container_services(status);
CREATE INDEX IF NOT EXISTS idx_container_services_template ON container_services(template_id);
CREATE INDEX IF NOT EXISTS idx_container_services_slug ON container_services(organization_id, slug);
CREATE INDEX IF NOT EXISTS idx_container_services_current_deployment ON container_services(current_deployment_id);
CREATE INDEX IF NOT EXISTS idx_container_services_created_at ON container_services(created_at DESC);

-- Container Deployments Indexes
CREATE INDEX IF NOT EXISTS idx_container_deployments_service ON container_deployments(service_id);
CREATE INDEX IF NOT EXISTS idx_container_deployments_worker ON container_deployments(worker_id);
CREATE INDEX IF NOT EXISTS idx_container_deployments_status ON container_deployments(status);
CREATE INDEX IF NOT EXISTS idx_container_deployments_swarm_service ON container_deployments(swarm_service_id);
CREATE INDEX IF NOT EXISTS idx_container_deployments_created_at ON container_deployments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_container_deployments_deployed_at ON container_deployments(deployed_at DESC);
-- Composite index for common query pattern: active deployments per service
CREATE INDEX IF NOT EXISTS idx_container_deployments_service_status ON container_deployments(service_id, status);

-- Container Builds Indexes
CREATE INDEX IF NOT EXISTS idx_container_builds_service ON container_builds(service_id);
CREATE INDEX IF NOT EXISTS idx_container_builds_deployment ON container_builds(deployment_id);
CREATE INDEX IF NOT EXISTS idx_container_builds_status ON container_builds(build_status);
CREATE INDEX IF NOT EXISTS idx_container_builds_commit ON container_builds(git_commit_sha);
CREATE INDEX IF NOT EXISTS idx_container_builds_created_at ON container_builds(created_at DESC);
-- Composite index for common query pattern: recent builds per service
CREATE INDEX IF NOT EXISTS idx_container_builds_service_created ON container_builds(service_id, created_at DESC);

-- Container Secrets Indexes
CREATE INDEX IF NOT EXISTS idx_container_secrets_org ON container_secrets(organization_id);
CREATE INDEX IF NOT EXISTS idx_container_secrets_created_by ON container_secrets(created_by);
CREATE INDEX IF NOT EXISTS idx_container_secrets_name ON container_secrets(organization_id, name);

-- Container Service Secrets Indexes
CREATE INDEX IF NOT EXISTS idx_container_service_secrets_service ON container_service_secrets(service_id);
CREATE INDEX IF NOT EXISTS idx_container_service_secrets_secret ON container_service_secrets(secret_id);

-- Container Billing Cycles Indexes
CREATE INDEX IF NOT EXISTS idx_container_billing_service ON container_billing_cycles(service_id);
CREATE INDEX IF NOT EXISTS idx_container_billing_org ON container_billing_cycles(organization_id);
CREATE INDEX IF NOT EXISTS idx_container_billing_status ON container_billing_cycles(status);
CREATE INDEX IF NOT EXISTS idx_container_billing_period_start ON container_billing_cycles(billing_period_start);
CREATE INDEX IF NOT EXISTS idx_container_billing_period_end ON container_billing_cycles(billing_period_end);
CREATE INDEX IF NOT EXISTS idx_container_billing_payment_transaction ON container_billing_cycles(payment_transaction_id);
-- Composite index for common query pattern: billing history per organization
CREATE INDEX IF NOT EXISTS idx_container_billing_org_period ON container_billing_cycles(organization_id, billing_period_start DESC);
-- Composite index for common query pattern: pending billing cycles
CREATE INDEX IF NOT EXISTS idx_container_billing_status_period ON container_billing_cycles(status, billing_period_end);


-- ============================================================
-- Triggers for updated_at Columns
-- ============================================================

-- Note: The update_updated_at_column() function already exists from 001_initial_schema.sql
-- We just need to create triggers for the new container tables

-- Container Workers trigger
CREATE TRIGGER update_container_workers_updated_at
  BEFORE UPDATE ON container_workers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Application Templates trigger
CREATE TRIGGER update_application_templates_updated_at
  BEFORE UPDATE ON application_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Container Services trigger
CREATE TRIGGER update_container_services_updated_at
  BEFORE UPDATE ON container_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Container Deployments trigger
CREATE TRIGGER update_container_deployments_updated_at
  BEFORE UPDATE ON container_deployments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Container Secrets trigger
CREATE TRIGGER update_container_secrets_updated_at
  BEFORE UPDATE ON container_secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Container Billing Cycles trigger
CREATE TRIGGER update_container_billing_cycles_updated_at
  BEFORE UPDATE ON container_billing_cycles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- Seed Default Application Templates
-- ============================================================

DO $$
BEGIN
  -- Node.js
  INSERT INTO application_templates (name, description, category, icon_url, nix_expression, default_env_vars, default_resource_limits, display_order)
  VALUES (
    'Node.js',
    'Basic Node.js application with npm support',
    'web',
    'https://nodejs.org/static/images/logo.svg',
    '{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_20
    npm
  ];
  
  shellHook = ''''
    npm install
    npm start
  '''';
}',
    '{"NODE_ENV": "production", "PORT": "3000"}'::jsonb,
    '{"cpu_cores": 1, "memory_mb": 512, "disk_gb": 10}'::jsonb,
    10
  ) ON CONFLICT DO NOTHING;

  -- Next.js
  INSERT INTO application_templates (name, description, category, icon_url, nix_expression, default_env_vars, default_resource_limits, display_order)
  VALUES (
    'Next.js',
    'Next.js React framework with server-side rendering',
    'web',
    'https://nextjs.org/static/favicon/favicon.ico',
    '{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_20
    npm
  ];
  
  shellHook = ''''
    npm install
    npm run build
    npm start
  '''';
}',
    '{"NODE_ENV": "production", "PORT": "3000"}'::jsonb,
    '{"cpu_cores": 2, "memory_mb": 1024, "disk_gb": 15}'::jsonb,
    11
  ) ON CONFLICT DO NOTHING;

  -- Express.js API
  INSERT INTO application_templates (name, description, category, icon_url, nix_expression, default_env_vars, default_resource_limits, display_order)
  VALUES (
    'Express.js API',
    'Express.js REST API server',
    'api',
    'https://expressjs.com/images/favicon.png',
    '{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_20
    npm
  ];
  
  shellHook = ''''
    npm install
    npm start
  '''';
}',
    '{"NODE_ENV": "production", "PORT": "3000", "API_VERSION": "v1"}'::jsonb,
    '{"cpu_cores": 1, "memory_mb": 512, "disk_gb": 10}'::jsonb,
    12
  ) ON CONFLICT DO NOTHING;

  -- Python
  INSERT INTO application_templates (name, description, category, icon_url, nix_expression, default_env_vars, default_resource_limits, display_order)
  VALUES (
    'Python',
    'Python application with pip support',
    'web',
    'https://www.python.org/static/favicon.ico',
    '{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    python311
    python311Packages.pip
    python311Packages.virtualenv
  ];
  
  shellHook = ''''
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    python app.py
  '''';
}',
    '{"PYTHONUNBUFFERED": "1", "PORT": "8000"}'::jsonb,
    '{"cpu_cores": 1, "memory_mb": 512, "disk_gb": 10}'::jsonb,
    20
  ) ON CONFLICT DO NOTHING;

  -- Django
  INSERT INTO application_templates (name, description, category, icon_url, nix_expression, default_env_vars, default_resource_limits, display_order)
  VALUES (
    'Django',
    'Django web framework with PostgreSQL support',
    'web',
    'https://static.djangoproject.com/img/icon-touch.e4872c4da341.png',
    '{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    python311
    python311Packages.pip
    python311Packages.django
    python311Packages.psycopg2
    postgresql
  ];
  
  shellHook = ''''
    pip install -r requirements.txt
    python manage.py migrate
    python manage.py collectstatic --noinput
    gunicorn myproject.wsgi:application --bind 0.0.0.0:8000
  '''';
}',
    '{"PYTHONUNBUFFERED": "1", "DJANGO_SETTINGS_MODULE": "myproject.settings", "PORT": "8000"}'::jsonb,
    '{"cpu_cores": 2, "memory_mb": 1024, "disk_gb": 15}'::jsonb,
    21
  ) ON CONFLICT DO NOTHING;

  -- Flask API
  INSERT INTO application_templates (name, description, category, icon_url, nix_expression, default_env_vars, default_resource_limits, display_order)
  VALUES (
    'Flask API',
    'Flask REST API with minimal setup',
    'api',
    'https://flask.palletsprojects.com/en/2.3.x/_static/flask-icon.png',
    '{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    python311
    python311Packages.pip
    python311Packages.flask
  ];
  
  shellHook = ''''
    pip install -r requirements.txt
    gunicorn app:app --bind 0.0.0.0:8000
  '''';
}',
    '{"PYTHONUNBUFFERED": "1", "FLASK_ENV": "production", "PORT": "8000"}'::jsonb,
    '{"cpu_cores": 1, "memory_mb": 512, "disk_gb": 10}'::jsonb,
    22
  ) ON CONFLICT DO NOTHING;

  -- Go
  INSERT INTO application_templates (name, description, category, icon_url, nix_expression, default_env_vars, default_resource_limits, display_order)
  VALUES (
    'Go',
    'Go application with module support',
    'api',
    'https://go.dev/favicon.ico',
    '{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    go_1_21
  ];
  
  shellHook = ''''
    go mod download
    go build -o app .
    ./app
  '''';
}',
    '{"GO_ENV": "production", "PORT": "8080"}'::jsonb,
    '{"cpu_cores": 1, "memory_mb": 256, "disk_gb": 10}'::jsonb,
    30
  ) ON CONFLICT DO NOTHING;

  -- Static Site
  INSERT INTO application_templates (name, description, category, icon_url, nix_expression, default_env_vars, default_resource_limits, display_order)
  VALUES (
    'Static Site',
    'Static HTML/CSS/JS site with nginx',
    'static',
    'https://nginx.org/favicon.ico',
    '{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nginx
  ];
  
  shellHook = ''''
    nginx -c nginx.conf -g ''daemon off;''
  '''';
}',
    '{"PORT": "80"}'::jsonb,
    '{"cpu_cores": 0.5, "memory_mb": 256, "disk_gb": 5}'::jsonb,
    40
  ) ON CONFLICT DO NOTHING;

  -- Vite Static Site
  INSERT INTO application_templates (name, description, category, icon_url, nix_expression, default_env_vars, default_resource_limits, display_order)
  VALUES (
    'Vite Static Site',
    'Vite-built static site (React, Vue, Svelte)',
    'static',
    'https://vitejs.dev/logo.svg',
    '{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_20
    npm
    nginx
  ];
  
  shellHook = ''''
    npm install
    npm run build
    nginx -c nginx.conf -g ''daemon off;''
  '''';
}',
    '{"NODE_ENV": "production", "PORT": "80"}'::jsonb,
    '{"cpu_cores": 1, "memory_mb": 512, "disk_gb": 10}'::jsonb,
    41
  ) ON CONFLICT DO NOTHING;

  -- MERN Stack (Multi-Service)
  INSERT INTO application_templates (name, description, category, icon_url, nix_expression, default_env_vars, default_resource_limits, is_multi_service, services, display_order)
  VALUES (
    'MERN Stack',
    'MongoDB + Express + React + Node.js full stack',
    'web',
    'https://nodejs.org/static/images/logo.svg',
    '{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_20
    npm
    mongodb
  ];
}',
    '{"NODE_ENV": "production", "PORT": "3000", "MONGODB_URI": "mongodb://mongodb:27017/myapp"}'::jsonb,
    '{"cpu_cores": 2, "memory_mb": 2048, "disk_gb": 20}'::jsonb,
    TRUE,
    '[
      {
        "name": "mongodb",
        "nixExpression": "{ pkgs ? import <nixpkgs> {} }: pkgs.mkShell { buildInputs = [ pkgs.mongodb ]; }",
        "resourceLimits": {"cpu_cores": 1, "memory_mb": 1024, "disk_gb": 10},
        "dependencies": [],
        "environmentVars": {"MONGO_INITDB_DATABASE": "myapp"}
      },
      {
        "name": "app",
        "nixExpression": "{ pkgs ? import <nixpkgs> {} }: pkgs.mkShell { buildInputs = [ pkgs.nodejs_20 pkgs.npm ]; }",
        "resourceLimits": {"cpu_cores": 1, "memory_mb": 1024, "disk_gb": 10},
        "dependencies": ["mongodb"],
        "environmentVars": {"NODE_ENV": "production", "PORT": "3000"}
      }
    ]'::jsonb,
    50
  ) ON CONFLICT DO NOTHING;

  -- Rails + PostgreSQL (Multi-Service)
  INSERT INTO application_templates (name, description, category, icon_url, nix_expression, default_env_vars, default_resource_limits, is_multi_service, services, display_order)
  VALUES (
    'Rails + PostgreSQL',
    'Ruby on Rails with PostgreSQL database',
    'web',
    'https://rubyonrails.org/assets/images/favicon.ico',
    '{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    ruby_3_2
    postgresql
  ];
}',
    '{"RAILS_ENV": "production", "PORT": "3000", "DATABASE_URL": "postgresql://postgres:5432/myapp"}'::jsonb,
    '{"cpu_cores": 2, "memory_mb": 2048, "disk_gb": 20}'::jsonb,
    TRUE,
    '[
      {
        "name": "postgres",
        "nixExpression": "{ pkgs ? import <nixpkgs> {} }: pkgs.mkShell { buildInputs = [ pkgs.postgresql ]; }",
        "resourceLimits": {"cpu_cores": 1, "memory_mb": 1024, "disk_gb": 10},
        "dependencies": [],
        "environmentVars": {"POSTGRES_DB": "myapp"}
      },
      {
        "name": "app",
        "nixExpression": "{ pkgs ? import <nixpkgs> {} }: pkgs.mkShell { buildInputs = [ pkgs.ruby_3_2 ]; }",
        "resourceLimits": {"cpu_cores": 1, "memory_mb": 1024, "disk_gb": 10},
        "dependencies": ["postgres"],
        "environmentVars": {"RAILS_ENV": "production", "PORT": "3000"}
      }
    ]'::jsonb,
    51
  ) ON CONFLICT DO NOTHING;

  -- Django + PostgreSQL + Redis (Multi-Service)
  INSERT INTO application_templates (name, description, category, icon_url, nix_expression, default_env_vars, default_resource_limits, is_multi_service, services, display_order)
  VALUES (
    'Django + PostgreSQL + Redis',
    'Django with PostgreSQL database and Redis cache',
    'web',
    'https://static.djangoproject.com/img/icon-touch.e4872c4da341.png',
    '{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    python311
    postgresql
    redis
  ];
}',
    '{"PYTHONUNBUFFERED": "1", "DJANGO_SETTINGS_MODULE": "myproject.settings", "PORT": "8000", "DATABASE_URL": "postgresql://postgres:5432/myapp", "REDIS_URL": "redis://redis:6379"}'::jsonb,
    '{"cpu_cores": 3, "memory_mb": 3072, "disk_gb": 25}'::jsonb,
    TRUE,
    '[
      {
        "name": "postgres",
        "nixExpression": "{ pkgs ? import <nixpkgs> {} }: pkgs.mkShell { buildInputs = [ pkgs.postgresql ]; }",
        "resourceLimits": {"cpu_cores": 1, "memory_mb": 1024, "disk_gb": 10},
        "dependencies": [],
        "environmentVars": {"POSTGRES_DB": "myapp"}
      },
      {
        "name": "redis",
        "nixExpression": "{ pkgs ? import <nixpkgs> {} }: pkgs.mkShell { buildInputs = [ pkgs.redis ]; }",
        "resourceLimits": {"cpu_cores": 0.5, "memory_mb": 512, "disk_gb": 5},
        "dependencies": [],
        "environmentVars": {}
      },
      {
        "name": "app",
        "nixExpression": "{ pkgs ? import <nixpkgs> {} }: pkgs.mkShell { buildInputs = [ pkgs.python311 ]; }",
        "resourceLimits": {"cpu_cores": 1.5, "memory_mb": 1536, "disk_gb": 10},
        "dependencies": ["postgres", "redis"],
        "environmentVars": {"PYTHONUNBUFFERED": "1", "PORT": "8000"}
      }
    ]'::jsonb,
    52
  ) ON CONFLICT DO NOTHING;

END $$;
