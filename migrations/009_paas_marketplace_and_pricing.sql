/**
 * Migration 009: PaaS Marketplace and Custom Pricing
 *
 * Adds:
 * - PaaS marketplace templates table
 * - PaaS marketplace addons table (databases, caching, storage)
 * - PaaS app pricing overrides table (for admin custom pricing)
 * - Template deployment tracking
 */

-- Table for marketplace templates (starter apps, frameworks, CMS)
CREATE TABLE IF NOT EXISTS paas_marketplace_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  category VARCHAR(100) NOT NULL, -- 'nodejs', 'python', 'php', 'cms', 'database', 'full-stack', etc.
  icon_url TEXT,
  git_url TEXT NOT NULL,
  git_branch VARCHAR(255) DEFAULT 'main',
  buildpack VARCHAR(255),
  default_env_vars JSONB DEFAULT '{}',
  required_addons JSONB DEFAULT '[]', -- Array of addon slugs required for this template
  recommended_plan_slug VARCHAR(255),
  min_cpu_cores INTEGER DEFAULT 1,
  min_ram_mb INTEGER DEFAULT 512,
  deploy_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table for marketplace addons (PostgreSQL, MySQL, Redis, etc.)
CREATE TABLE IF NOT EXISTS paas_marketplace_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  addon_type VARCHAR(100) NOT NULL, -- 'database', 'cache', 'storage', 'monitoring', etc.
  provider VARCHAR(100), -- 'internal', 'aws', etc.
  config_template JSONB DEFAULT '{}', -- Template configuration for the addon
  default_env_vars JSONB DEFAULT '{}', -- Environment variables to inject into apps
  price_per_hour DECIMAL(10,4) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table for app pricing overrides (admin custom pricing)
CREATE TABLE IF NOT EXISTS paas_app_pricing_overrides (
  application_id UUID PRIMARY KEY REFERENCES paas_applications(id) ON DELETE CASCADE,
  custom_price_per_hour DECIMAL(10,4) NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table for tracking template deployments
CREATE TABLE IF NOT EXISTS paas_template_deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES paas_applications(id) ON DELETE CASCADE,
  template_id UUID REFERENCES paas_marketplace_templates(id) ON DELETE SET NULL,
  deployed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  custom_env_vars JSONB DEFAULT '{}',
  selected_addons JSONB DEFAULT '[]', -- Array of addon IDs that were added
  deployment_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'deploying', 'completed', 'failed'
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table for app addons (links apps to marketplace addons)
CREATE TABLE IF NOT EXISTS paas_app_addons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES paas_applications(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES paas_marketplace_addons(id) ON DELETE CASCADE,
  config JSONB DEFAULT '{}', -- Instance-specific configuration
  status VARCHAR(50) DEFAULT 'provisioning', -- 'provisioning', 'active', 'failed', 'deleted'
  connection_info JSONB DEFAULT '{}', -- Connection details (host, port, credentials)
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(application_id, addon_id)
);

-- Indexes for marketplace templates
CREATE INDEX IF NOT EXISTS idx_marketplace_templates_category ON paas_marketplace_templates(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_templates_active ON paas_marketplace_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_marketplace_templates_featured ON paas_marketplace_templates(is_featured);
CREATE INDEX IF NOT EXISTS idx_marketplace_templates_slug ON paas_marketplace_templates(slug);

-- Indexes for marketplace addons
CREATE INDEX IF NOT EXISTS idx_marketplace_addons_type ON paas_marketplace_addons(addon_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_addons_active ON paas_marketplace_addons(is_active);
CREATE INDEX IF NOT EXISTS idx_marketplace_addons_slug ON paas_marketplace_addons(slug);

-- Indexes for template deployments
CREATE INDEX IF NOT EXISTS idx_template_deployments_app ON paas_template_deployments(application_id);
CREATE INDEX IF NOT EXISTS idx_template_deployments_template ON paas_template_deployments(template_id);
CREATE INDEX IF NOT EXISTS idx_template_deployments_status ON paas_template_deployments(deployment_status);

-- Indexes for app addons
CREATE INDEX IF NOT EXISTS idx_app_addons_application ON paas_app_addons(application_id);
CREATE INDEX IF NOT EXISTS idx_app_addons_addon ON paas_app_addons(addon_id);
CREATE INDEX IF NOT EXISTS idx_app_addons_status ON paas_app_addons(status);

-- Insert some default marketplace templates
INSERT INTO paas_marketplace_templates (name, slug, description, category, git_url, buildpack, recommended_plan_slug) VALUES
('Node.js Express Starter', 'nodejs-express', 'A minimal Express.js application with basic routing and middleware setup', 'nodejs', 'https://github.com/expressjs/express-starter', 'heroku/nodejs', 'starter'),
('React SPA', 'react-spa', 'Single Page Application built with Create React App', 'frontend', 'https://github.com/facebook/create-react-app', 'heroku/nodejs', 'starter'),
('Next.js App', 'nextjs', 'Full-stack React framework with SSR and API routes', 'full-stack', 'https://github.com/vercel/next.js/tree/canary/examples/hello-world', 'heroku/nodejs', 'growth'),
('Django REST API', 'django-rest', 'Django REST Framework API with authentication', 'python', 'https://github.com/encode/django-rest-framework', 'heroku/python', 'growth'),
('Flask API', 'flask-api', 'Lightweight Python Flask REST API', 'python', 'https://github.com/pallets/flask', 'heroku/python', 'starter'),
('Laravel App', 'laravel', 'PHP Laravel framework with Eloquent ORM', 'php', 'https://github.com/laravel/laravel', 'heroku/php', 'growth'),
('WordPress', 'wordpress', 'Popular CMS for blogs and websites', 'cms', 'https://github.com/WordPress/WordPress', 'heroku/php', 'growth'),
('Ghost Blog', 'ghost', 'Modern publishing platform built on Node.js', 'cms', 'https://github.com/TryGhost/Ghost', 'heroku/nodejs', 'growth'),
('Strapi CMS', 'strapi', 'Headless CMS built with Node.js', 'cms', 'https://github.com/strapi/strapi', 'heroku/nodejs', 'growth'),
('Vue.js SPA', 'vue-spa', 'Progressive JavaScript framework for building UIs', 'frontend', 'https://github.com/vuejs/create-vue', 'heroku/nodejs', 'starter'),
('Nuxt.js App', 'nuxtjs', 'Vue.js framework with SSR capabilities', 'full-stack', 'https://github.com/nuxt/starter', 'heroku/nodejs', 'growth'),
('SvelteKit App', 'sveltekit', 'Cybernetically enhanced web apps with Svelte', 'full-stack', 'https://github.com/sveltejs/kit', 'heroku/nodejs', 'starter'),
('FastAPI', 'fastapi', 'Modern, fast Python web framework for building APIs', 'python', 'https://github.com/tiangolo/fastapi', 'heroku/python', 'starter'),
('Ruby on Rails', 'rails', 'Full-stack web application framework in Ruby', 'full-stack', 'https://github.com/rails/rails', 'heroku/ruby', 'growth'),
('Go Gin API', 'go-gin', 'High-performance HTTP web framework in Go', 'golang', 'https://github.com/gin-gonic/gin', 'heroku/go', 'starter')
ON CONFLICT (slug) DO NOTHING;

-- Insert default marketplace addons
INSERT INTO paas_marketplace_addons (name, slug, description, addon_type, provider, price_per_hour) VALUES
('PostgreSQL 14', 'postgresql-14', 'PostgreSQL 14 database with 10GB storage', 'database', 'internal', 0.015),
('PostgreSQL 15', 'postgresql-15', 'PostgreSQL 15 database with 10GB storage', 'database', 'internal', 0.018),
('MySQL 8.0', 'mysql-8', 'MySQL 8.0 database with 10GB storage', 'database', 'internal', 0.015),
('Redis Cache', 'redis', 'Redis 7 in-memory data store for caching', 'cache', 'internal', 0.010),
('MongoDB', 'mongodb', 'MongoDB NoSQL database with 10GB storage', 'database', 'internal', 0.020),
('Elasticsearch', 'elasticsearch', 'Full-text search and analytics engine', 'search', 'internal', 0.030),
('S3 Object Storage', 's3-storage', 'Object storage compatible with AWS S3', 'storage', 'internal', 0.005)
ON CONFLICT (slug) DO NOTHING;

-- Update marketplace template featured status
UPDATE paas_marketplace_templates
SET is_featured = true
WHERE slug IN ('nodejs-express', 'react-spa', 'nextjs', 'django-rest', 'laravel', 'wordpress');
