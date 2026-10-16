import pg from "pg"
import { HttpError } from "./http.js"

const { Pool } = pg

let pool

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new HttpError(503, "Falta DATABASE_URL para conectar PostgreSQL")
  }
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return pool
}

export async function query(text, params) {
  return getPool().query(text, params)
}

export async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS store_settings (
      id text PRIMARY KEY,
      name text NOT NULL,
      whatsapp text NOT NULL DEFAULT '',
      cover_title text NOT NULL DEFAULT '',
      cover_subtitle text NOT NULL DEFAULT '',
      cover_image bytea,
      cover_focus_x double precision NOT NULL DEFAULT 50,
      cover_focus_y double precision NOT NULL DEFAULT 50,
      cover_updated timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS admins (
      email text PRIMARY KEY,
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id text PRIMARY KEY,
      name text NOT NULL,
      detail text NOT NULL DEFAULT '',
      description text NOT NULL DEFAULT '',
      price integer NOT NULL,
      image bytea,
      image_updated timestamptz NOT NULL DEFAULT now(),
      available boolean NOT NULL DEFAULT true,
      discount integer NOT NULL DEFAULT 0,
      ready_days integer NOT NULL DEFAULT 0,
      position integer NOT NULL DEFAULT 0
    )
  `)
}
