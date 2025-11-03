/**
 * Container Template Service for SkyPanelV2
 * Handles container template management operations
 */

import { query } from '../lib/database.js';

export interface ContainerTemplate {
  id: string;
  templateName: string;
  displayName: string;
  description: string;
  category: string;
  templateSchema: TemplateSchema;
  enabled: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateSchema {
  services: TemplateService[];
}

export interface TemplateService {
  name: string;
  type: string;
  configuration: Record<string, any>;
}

export interface CreateTemplateInput {
  templateName: string;
  displayName: string;
  description?: string;
  category?: string;
  templateSchema: TemplateSchema;
  displayOrder?: number;
}

export interface UpdateTemplateInput {
  templateName?: string;
  displayName?: string;
  description?: string;
  category?: string;
  templateSchema?: TemplateSchema;
  displayOrder?: number;
}

export class ContainerTemplateService {
  /**
   * List enabled templates for users
   */
  static async listEnabledTemplates(): Promise<ContainerTemplate[]> {
    try {
      const result = await query(`
        SELECT 
          id,
          template_name,
          display_name,
          description,
          category,
          template_schema,
          enabled,
          display_order,
          created_at,
          updated_at
        FROM container_templates
        WHERE enabled = true
        ORDER BY display_order ASC, display_name ASC
      `);

      return result.rows.map(row => ({
        id: row.id,
        templateName: row.template_name,
        displayName: row.display_name,
        description: row.description,
        category: row.category,
        templateSchema: row.template_schema,
        enabled: row.enabled,
        displayOrder: row.display_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Error listing enabled container templates:', error);
      throw new Error('Failed to list enabled container templates');
    }
  }

  /**
   * List all templates for admin
   */
  static async listAllTemplates(): Promise<ContainerTemplate[]> {
    try {
      const result = await query(`
        SELECT 
          id,
          template_name,
          display_name,
          description,
          category,
          template_schema,
          enabled,
          display_order,
          created_at,
          updated_at
        FROM container_templates
        ORDER BY enabled DESC, display_order ASC, display_name ASC
      `);

      return result.rows.map(row => ({
        id: row.id,
        templateName: row.template_name,
        displayName: row.display_name,
        description: row.description,
        category: row.category,
        templateSchema: row.template_schema,
        enabled: row.enabled,
        displayOrder: row.display_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Error listing all container templates:', error);
      throw new Error('Failed to list all container templates');
    }
  }

  /**
   * Get a specific template by ID
   */
  static async getTemplate(templateId: string): Promise<ContainerTemplate | null> {
    try {
      const result = await query(`
        SELECT 
          id,
          template_name,
          display_name,
          description,
          category,
          template_schema,
          enabled,
          display_order,
          created_at,
          updated_at
        FROM container_templates
        WHERE id = $1
      `, [templateId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        templateName: row.template_name,
        displayName: row.display_name,
        description: row.description,
        category: row.category,
        templateSchema: row.template_schema,
        enabled: row.enabled,
        displayOrder: row.display_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('Error getting container template:', error);
      throw new Error('Failed to get container template');
    }
  }

  /**
   * Create a new template
   */
  static async createTemplate(templateData: CreateTemplateInput): Promise<ContainerTemplate> {
    try {
      // Validate input
      if (!templateData.templateName || templateData.templateName.trim().length === 0) {
        throw new Error('Template name is required');
      }
      if (!templateData.displayName || templateData.displayName.trim().length === 0) {
        throw new Error('Display name is required');
      }
      if (!templateData.templateSchema || !templateData.templateSchema.services) {
        throw new Error('Template schema is required');
      }
      if (!Array.isArray(templateData.templateSchema.services) || templateData.templateSchema.services.length === 0) {
        throw new Error('Template schema must contain at least one service');
      }

      // Validate template name pattern (similar to project/service names)
      const namePattern = /^[a-z0-9-_]+$/;
      if (!namePattern.test(templateData.templateName)) {
        throw new Error('Template name must contain only lowercase letters, numbers, hyphens, and underscores');
      }

      const result = await query(`
        INSERT INTO container_templates (
          template_name, display_name, description, category, 
          template_schema, display_order
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING 
          id, template_name, display_name, description, category,
          template_schema, enabled, display_order, created_at, updated_at
      `, [
        templateData.templateName.trim(),
        templateData.displayName.trim(),
        templateData.description?.trim() || null,
        templateData.category?.trim() || null,
        JSON.stringify(templateData.templateSchema),
        templateData.displayOrder || 0
      ]);

      const row = result.rows[0];
      return {
        id: row.id,
        templateName: row.template_name,
        displayName: row.display_name,
        description: row.description,
        category: row.category,
        templateSchema: row.template_schema,
        enabled: row.enabled,
        displayOrder: row.display_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('Error creating container template:', error);
      if (error instanceof Error && error.message.includes('duplicate key')) {
        throw new Error('A template with this name already exists');
      }
      throw error instanceof Error ? error : new Error('Failed to create container template');
    }
  }

  /**
   * Update an existing template
   */
  static async updateTemplate(templateId: string, updates: UpdateTemplateInput): Promise<ContainerTemplate> {
    try {
      // Validate input
      if (updates.templateName !== undefined && updates.templateName.trim().length === 0) {
        throw new Error('Template name cannot be empty');
      }
      if (updates.displayName !== undefined && updates.displayName.trim().length === 0) {
        throw new Error('Display name cannot be empty');
      }
      if (updates.templateSchema !== undefined) {
        if (!updates.templateSchema.services || !Array.isArray(updates.templateSchema.services) || updates.templateSchema.services.length === 0) {
          throw new Error('Template schema must contain at least one service');
        }
      }

      // Validate template name pattern if provided
      if (updates.templateName !== undefined) {
        const namePattern = /^[a-z0-9-_]+$/;
        if (!namePattern.test(updates.templateName)) {
          throw new Error('Template name must contain only lowercase letters, numbers, hyphens, and underscores');
        }
      }

      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.templateName !== undefined) {
        updateFields.push(`template_name = $${paramIndex++}`);
        values.push(updates.templateName.trim());
      }
      if (updates.displayName !== undefined) {
        updateFields.push(`display_name = $${paramIndex++}`);
        values.push(updates.displayName.trim());
      }
      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        values.push(updates.description?.trim() || null);
      }
      if (updates.category !== undefined) {
        updateFields.push(`category = $${paramIndex++}`);
        values.push(updates.category?.trim() || null);
      }
      if (updates.templateSchema !== undefined) {
        updateFields.push(`template_schema = $${paramIndex++}`);
        values.push(JSON.stringify(updates.templateSchema));
      }
      if (updates.displayOrder !== undefined) {
        updateFields.push(`display_order = $${paramIndex++}`);
        values.push(updates.displayOrder);
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(templateId);

      const result = await query(`
        UPDATE container_templates 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING 
          id, template_name, display_name, description, category,
          template_schema, enabled, display_order, created_at, updated_at
      `, values);

      if (result.rows.length === 0) {
        throw new Error('Container template not found');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        templateName: row.template_name,
        displayName: row.display_name,
        description: row.description,
        category: row.category,
        templateSchema: row.template_schema,
        enabled: row.enabled,
        displayOrder: row.display_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('Error updating container template:', error);
      if (error instanceof Error && error.message.includes('duplicate key')) {
        throw new Error('A template with this name already exists');
      }
      throw error instanceof Error ? error : new Error('Failed to update container template');
    }
  }

  /**
   * Enable a template
   */
  static async enableTemplate(templateId: string): Promise<void> {
    try {
      const result = await query(`
        UPDATE container_templates 
        SET enabled = true
        WHERE id = $1
      `, [templateId]);

      if (result.rowCount === 0) {
        throw new Error('Container template not found');
      }
    } catch (error) {
      console.error('Error enabling container template:', error);
      throw error instanceof Error ? error : new Error('Failed to enable container template');
    }
  }

  /**
   * Disable a template
   */
  static async disableTemplate(templateId: string): Promise<void> {
    try {
      const result = await query(`
        UPDATE container_templates 
        SET enabled = false
        WHERE id = $1
      `, [templateId]);

      if (result.rowCount === 0) {
        throw new Error('Container template not found');
      }
    } catch (error) {
      console.error('Error disabling container template:', error);
      throw error instanceof Error ? error : new Error('Failed to disable container template');
    }
  }

  /**
   * Get template by name (useful for template deployment)
   */
  static async getTemplateByName(templateName: string): Promise<ContainerTemplate | null> {
    try {
      const result = await query(`
        SELECT 
          id,
          template_name,
          display_name,
          description,
          category,
          template_schema,
          enabled,
          display_order,
          created_at,
          updated_at
        FROM container_templates
        WHERE template_name = $1 AND enabled = true
      `, [templateName]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        templateName: row.template_name,
        displayName: row.display_name,
        description: row.description,
        category: row.category,
        templateSchema: row.template_schema,
        enabled: row.enabled,
        displayOrder: row.display_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('Error getting container template by name:', error);
      throw new Error('Failed to get container template by name');
    }
  }

  /**
   * List templates by category
   */
  static async listTemplatesByCategory(category: string, enabledOnly: boolean = true): Promise<ContainerTemplate[]> {
    try {
      const whereClause = enabledOnly ? 'WHERE category = $1 AND enabled = true' : 'WHERE category = $1';
      
      const result = await query(`
        SELECT 
          id,
          template_name,
          display_name,
          description,
          category,
          template_schema,
          enabled,
          display_order,
          created_at,
          updated_at
        FROM container_templates
        ${whereClause}
        ORDER BY display_order ASC, display_name ASC
      `, [category]);

      return result.rows.map(row => ({
        id: row.id,
        templateName: row.template_name,
        displayName: row.display_name,
        description: row.description,
        category: row.category,
        templateSchema: row.template_schema,
        enabled: row.enabled,
        displayOrder: row.display_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Error listing container templates by category:', error);
      throw new Error('Failed to list container templates by category');
    }
  }

  /**
   * Get all unique categories
   */
  static async getCategories(enabledOnly: boolean = true): Promise<string[]> {
    try {
      const whereClause = enabledOnly ? 'WHERE enabled = true AND category IS NOT NULL' : 'WHERE category IS NOT NULL';
      
      const result = await query(`
        SELECT DISTINCT category
        FROM container_templates
        ${whereClause}
        ORDER BY category ASC
      `);

      return result.rows.map(row => row.category).filter(Boolean);
    } catch (error) {
      console.error('Error getting container template categories:', error);
      throw new Error('Failed to get container template categories');
    }
  }
}