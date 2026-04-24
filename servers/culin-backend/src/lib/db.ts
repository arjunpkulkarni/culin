/**
 * Database connection utility for RDS PostgreSQL
 */

import { Pool, PoolClient } from 'pg';

// Singleton pool instance
let pool: Pool | null = null;

/**
 * Get or create a PostgreSQL connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.RDS_HOST || 'culinai-db.csn2c4yowuvc.us-east-1.rds.amazonaws.com',
      port: parseInt(process.env.RDS_PORT || '5432'),
      database: process.env.RDS_DATABASE || 'culinAI_DB',
      user: process.env.RDS_USER || 'culinAI_DB',
      password: process.env.RDS_PASSWORD, // Required! Set in .env.local
      ssl: {
        rejectUnauthorized: false, // For RDS with SSL
      },
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  return pool;
}

/**
 * Execute a query with automatic connection management
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    const result = await client.query(text, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount || 0,
    };
  } finally {
    client.release();
  }
}

/**
 * Get a client for transaction management
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return await pool.connect();
}

/**
 * Close the pool (useful for cleanup in tests)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Type definitions for user profile
export interface UserProfile {
  user_id: string;
  email: string;
  display_name?: string;
  date_of_birth?: string;
  height?: number;
  weight?: number;
  sex?: 'M' | 'F' | 'Other';
  goals?: string[];
  health_conditions?: string[];
  dietary_restrictions?: string[];
  target_calories?: number;
  target_protein?: number;
  target_carbs?: number;
  target_fat?: number;
  photo_url?: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}
