import express, { Request, Response } from "express";
import { query } from "../lib/database.js";
// Containers pricing removed

const router = express.Router();

/**
 * GET /api/pricing/vps
 * 
 * Public endpoint to retrieve available VPS plans for pricing display.
 * No authentication required - this is for public pricing pages.
 */
router.get("/vps", async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT
         id,
         name,
         COALESCE(specifications->>'description', '') AS description,
         provider_id,
         provider_plan_id,
         base_price,
         markup_price,
         backup_price_monthly,
         backup_price_hourly,
         backup_upcharge_monthly,
         backup_upcharge_hourly,
         daily_backups_enabled,
         weekly_backups_enabled,
         COALESCE(specifications->>'region_id', specifications->>'region') AS region_id,
         specifications
       FROM vps_plans
       WHERE active = true
       ORDER BY base_price + markup_price ASC`
    );

    const plans = (result.rows || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      provider_id: row.provider_id,
      provider_plan_id: row.provider_plan_id,
      base_price: row.base_price,
      markup_price: row.markup_price,
      backup_price_monthly: row.backup_price_monthly || 0,
      backup_price_hourly: row.backup_price_hourly || 0,
      backup_upcharge_monthly: row.backup_upcharge_monthly || 0,
      backup_upcharge_hourly: row.backup_upcharge_hourly || 0,
      daily_backups_enabled: row.daily_backups_enabled || false,
      weekly_backups_enabled: row.weekly_backups_enabled !== false,
      region_id: row.region_id,
      specifications: row.specifications,
    }));

    res.json({ plans });
  } catch (error) {
    console.error("Public VPS plans fetch error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch VPS plans";
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/pricing/containers
 * 
 * Public endpoint to retrieve available container plans for pricing display.
 * No authentication required - this is for public pricing pages.
 */
// GET /api/pricing/containers removed

/**
 * GET /api/pricing
 * 
 * Public endpoint to retrieve all pricing information (VPS + containers).
 * No authentication required - this is for public pricing pages.
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    // Fetch VPS plans
    const vpsResult = await query(
      `SELECT
         id,
         name,
         COALESCE(specifications->>'description', '') AS description,
         provider_id,
         provider_plan_id,
         base_price,
         markup_price,
         backup_price_monthly,
         backup_price_hourly,
         backup_upcharge_monthly,
         backup_upcharge_hourly,
         daily_backups_enabled,
         weekly_backups_enabled,
         COALESCE(specifications->>'region_id', specifications->>'region') AS region_id,
         specifications
       FROM vps_plans
       WHERE active = true
       ORDER BY base_price + markup_price ASC`
    );

    const vpsPlans = (vpsResult.rows || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      provider_id: row.provider_id,
      provider_plan_id: row.provider_plan_id,
      base_price: row.base_price,
      markup_price: row.markup_price,
      backup_price_monthly: row.backup_price_monthly || 0,
      backup_price_hourly: row.backup_price_hourly || 0,
      backup_upcharge_monthly: row.backup_upcharge_monthly || 0,
      backup_upcharge_hourly: row.backup_upcharge_hourly || 0,
      daily_backups_enabled: row.daily_backups_enabled || false,
      weekly_backups_enabled: row.weekly_backups_enabled !== false,
      region_id: row.region_id,
      specifications: row.specifications,
    }));

    res.json({
      vps: vpsPlans
    });
  } catch (error) {
    console.error("Public pricing fetch error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch pricing information";
    res.status(500).json({ error: message });
  }
});

export default router;
