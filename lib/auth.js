import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { query } from "./db.js"
import { HttpError } from "./http.js"

const WEEK = 7 * 24 * 60 * 60 * 1000

function secret() {
  return process.env.SESSION_SECRET || "prodigo-admin-session"
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 32).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":")
  if (!salt || !hash) return false
  const next = scryptSync(password, salt, 32).toString("hex")
  const left = Buffer.from(hash)
  const right = Buffer.from(next)
  return left.length === right.length && timingSafeEqual(left, right)
}

export function signSession(email) {
  const body = Buffer.from(
    JSON.stringify({ email, exp: Date.now() + WEEK }),
  ).toString("base64url")
  const signature = createHmac("sha256", secret()).update(body).digest("base64url")
  return `${body}.${signature}`
}

function readSession(token) {
  const [body, signature] = String(token || "").split(".")
  if (!body || !signature) {
    throw new HttpError(401, "La sesión no es válida")
  }
  const expected = createHmac("sha256", secret()).update(body).digest("base64url")
  const left = Buffer.from(signature)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new HttpError(401, "La sesión no es válida")
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  if (!payload?.email || payload.exp < Date.now()) {
    throw new HttpError(401, "La sesión expiró")
  }
  return payload
}

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ""
    const token = header.startsWith("Bearer ") ? header.slice(7) : ""
    if (!token) throw new HttpError(401, "Inicia sesión para continuar")
    const payload = readSession(token)
    req.user = { email: payload.email }
    next()
  } catch (error) {
    const status = error.status || 401
    res.status(status).json({ error: error.message || "La sesión no es válida" })
  }
}

function cleanEmail(email) {
  return String(email || "").trim().toLowerCase()
}

export async function adminSetupAvailable() {
  const result = await query("SELECT 1 FROM admins LIMIT 1")
  return result.rowCount === 0
}

export async function registerAdmin(email, password) {
  const clean = cleanEmail(email)
  if (!clean.includes("@") || clean.length > 120) {
    throw new HttpError(400, "Escribe un correo válido")
  }
  if (String(password).length < 6) {
    throw new HttpError(400, "La contraseña debe tener al menos 6 caracteres")
  }
  const inserted = await query(
    `INSERT INTO admins (email, password_hash)
     SELECT $1, $2
     WHERE NOT EXISTS (SELECT 1 FROM admins)
     RETURNING email`,
    [clean, hashPassword(password)],
  )
  if (!inserted.rowCount) {
    throw new HttpError(409, "El administrador ya está registrado")
  }
  return { email: inserted.rows[0].email, token: signSession(inserted.rows[0].email) }
}

export async function loginAdmin(email, password) {
  const result = await query("SELECT email, password_hash FROM admins WHERE email = $1", [
    cleanEmail(email),
  ])
  const admin = result.rows[0]
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    throw new HttpError(401, "Correo o contraseña incorrectos")
  }
  return { email: admin.email, token: signSession(admin.email) }
}
