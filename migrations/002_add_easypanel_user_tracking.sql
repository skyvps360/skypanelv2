-- Migration: Add Easypanel user tracking and WordPress template
-- Description: Adds fields to track Easypanel user accounts and adds WordPress template
-- Date: 2025-11-03

-- Add Easypanel user tracking fields to container_subscriptions
ALTER TABLE container_subscriptions
ADD COLUMN IF NOT EXISTS easypanel_user_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS easypanel_user_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS easypanel_password_encrypted TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_container_subscriptions_easypanel_user 
ON container_subscriptions(easypanel_user_id);

-- Insert WordPress template
INSERT INTO container_templates (
    template_name,
    display_name,
    description,
    category,
    template_schema,
    enabled,
    display_order
) VALUES (
    'wordpress',
    'WordPress',
    'Popular content management system with integrated MySQL/MariaDB database and automatic PHP configuration. Perfect for blogs, websites, and web applications.',
    'CMS',
    '{
        "services": [
            {
                "name": "wordpress",
                "type": "wordpress",
                "configuration": {
                    "database": {
                        "serviceName": "wordpress-db",
                        "type": "mysql",
                        "version": "8.0"
                    },
                    "php": {
                        "version": "8.2",
                        "extensions": [
                            "gd",
                            "mysqli",
                            "opcache",
                            "zip",
                            "intl",
                            "mbstring",
                            "curl",
                            "xml",
                            "imagick"
                        ],
                        "config": {
                            "upload_max_filesize": "256M",
                            "post_max_size": "256M",
                            "memory_limit": "256M",
                            "max_execution_time": "300"
                        }
                    },
                    "nginx": {
                        "config": "# WordPress Nginx configuration\nclient_max_body_size 256M;\nfastcgi_buffers 16 16k;\nfastcgi_buffer_size 32k;"
                    },
                    "resources": {
                        "cpuLimit": 1.0,
                        "memoryLimit": 1024,
                        "memoryReservation": 512
                    },
                    "env": {
                        "WORDPRESS_DB_HOST": "wordpress-db:3306",
                        "WORDPRESS_DB_NAME": "wordpress",
                        "WORDPRESS_TABLE_PREFIX": "wp_"
                    },
                    "mounts": [
                        {
                            "type": "volume",
                            "name": "wordpress-data",
                            "mountPath": "/var/www/html"
                        }
                    ]
                }
            },
            {
                "name": "wordpress-db",
                "type": "mysql",
                "configuration": {
                    "version": "8.0",
                    "database": "wordpress",
                    "user": "wordpress",
                    "resources": {
                        "cpuLimit": 0.5,
                        "memoryLimit": 512,
                        "memoryReservation": 256
                    },
                    "mounts": [
                        {
                            "type": "volume",
                            "name": "wordpress-db-data",
                            "mountPath": "/var/lib/mysql"
                        }
                    ],
                    "advanced": {
                        "config": "# MySQL configuration for WordPress\nmax_allowed_packet=256M\ninnodb_buffer_pool_size=256M\ninnodb_log_file_size=64M"
                    }
                }
            }
        ]
    }'::jsonb,
    TRUE,
    10
)
ON CONFLICT (template_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    template_schema = EXCLUDED.template_schema,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();
