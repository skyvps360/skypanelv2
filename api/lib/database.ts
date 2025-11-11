import { Pool, PoolClient } from "pg";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Get PostgreSQL configuration from environment variables
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error("Missing PostgreSQL configuration:");
    console.error("DATABASE_URL:", databaseUrl ? "Set" : "Missing");
    throw new Error("Missing required DATABASE_URL environment variable");
}

// Create PostgreSQL connection pool
export const pool = new Pool({
    connectionString: databaseUrl,
    ssl:
        process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Database connection helper
export const getDbClient = async (): Promise<PoolClient> => {
    return await pool.connect();
};

// Query helper function
export const query = async (text: string, params?: any[]): Promise<any> => {
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return result;
    } finally {
        client.release();
    }
};

// Transaction helper
export const transaction = async (
    callback: (client: PoolClient) => Promise<any>,
): Promise<any> => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await callback(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

// Database types for PostgreSQL
export interface User {
    id: string;
    email: string;
    password_hash: string;
    name: string;
    role: "admin" | "user";
    phone?: string;
    timezone?: string;
    preferences?: any;
    created_at: string;
    updated_at: string;
}

export interface Organization {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    settings: any;
    website?: string;
    address?: string;
    tax_id?: string;
    created_at: string;
    updated_at: string;
}

export interface VpsInstance {
    id: string;
    organization_id: string;
    plan_id: string;
    provider_instance_id: string;
    label: string;
    status: string;
    ip_address: string | null;
    configuration: any;
    created_at: string;
    updated_at: string;
}

export interface SupportTicket {
    id: string;
    organization_id: string;
    created_by: string;
    subject: string;
    message: string;
    status: "open" | "in_progress" | "resolved" | "closed";
    priority: "low" | "medium" | "high" | "urgent";
    category: string;
    created_at: string;
    updated_at: string;
}

export interface Wallet {
    id: string;
    organization_id: string;
    balance: number;
    currency: string;
    created_at: string;
    updated_at: string;
}

export interface UserApiKey {
    id: string;
    user_id: string;
    key_name: string;
    key_hash: string;
    key_prefix: string;
    permissions?: any;
    last_used_at?: string;
    expires_at?: string;
    active: boolean;
    created_at: string;
    updated_at: string;
}
