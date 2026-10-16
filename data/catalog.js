import fs from "node:fs"
import path from "node:path"
import { ensureSchema, query } from "../lib/db.js"
import { HttpError } from "../lib/http.js"
import { makeId } from "../lib/validate.js"
import { seed } from "./seed.js"

const STORE_ID = "prodigo"

function toBytes(dataUrl) {
  if (!dataUrl) return null
  const encoded = String(dataUrl).split(",")[1] || ""
  return Buffer.from(encoded, "base64")
}

function mediaPath(base, updated) {
  const version = updated ? new Date(updated).getTime() : 0
  return `${base}?v=${version}`
}

export async function readStore() {
  await ensureStore()
  const storeResult = await query(
    `SELECT name, whatsapp, cover_title, cover_subtitle, cover_focus_x, cover_focus_y, cover_updated,
            (cover_image IS NOT NULL) AS has_cover
     FROM store_settings WHERE id = $1`,
    [STORE_ID],
  )
  const store = storeResult.rows[0]
  const productsResult = await query(
    `SELECT id, name, detail, description, price, available, discount, ready_days, position, image_updated,
            (image IS NOT NULL) AS has_image
     FROM products ORDER BY position, name`,
  )
  return {
    cover: {
      title: store.cover_title,
      subtitle: store.cover_subtitle,
      image: store.has_cover ? mediaPath("/api/cover/image", store.cover_updated) : null,
      focusX: store.cover_focus_x,
      focusY: store.cover_focus_y,
    },
    products: productsResult.rows.map((product) => ({
      id: product.id,
      name: product.name,
      detail: product.detail || "",
      description: product.description || "",
      price: product.price,
      image: product.has_image ? mediaPath(`/api/products/${product.id}/image`, product.image_updated) : null,
      available: product.available !== false,
      discount: product.discount || 0,
      readyDays: product.ready_days || 0,
    })),
    whatsapp: store.whatsapp || "",
  }
}

export async function readCoverImage() {
  await ensureStore()
  const result = await query("SELECT cover_image FROM store_settings WHERE id = $1", [STORE_ID])
  return result.rows[0]?.cover_image || null
}

export async function readProductImage(id) {
  await ensureStore()
  const result = await query("SELECT image FROM products WHERE id = $1", [id])
  return result.rows[0]?.image || null
}

export async function updateWhatsapp(whatsapp) {
  await ensureStore()
  await query("UPDATE store_settings SET whatsapp = $1 WHERE id = $2", [whatsapp, STORE_ID])
  return readStore()
}

export async function updateCover({ image, focusX, focusY }) {
  await ensureStore()
  if (image === undefined) {
    await query(
      "UPDATE store_settings SET cover_focus_x = $1, cover_focus_y = $2 WHERE id = $3",
      [focusX, focusY, STORE_ID],
    )
  } else {
    await query(
      `UPDATE store_settings
       SET cover_image = $1, cover_focus_x = $2, cover_focus_y = $3, cover_updated = now()
       WHERE id = $4`,
      [toBytes(image), focusX, focusY, STORE_ID],
    )
  }
  return readStore()
}

export async function createProduct(input) {
  await ensureStore()
  const current = await query("SELECT id FROM products")
  const id = makeId(input.name, current.rows)
  const position = await query("SELECT COALESCE(MAX(position), -1) + 1 AS next FROM products")
  await query(
    `INSERT INTO products
      (id, name, detail, description, price, image, available, discount, ready_days, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      input.name,
      input.detail,
      input.description,
      input.price,
      toBytes(input.image),
      input.available !== false,
      input.discount || 0,
      input.readyDays || 0,
      position.rows[0].next,
    ],
  )
  return readStore()
}

export async function updateProduct(id, input) {
  const existing = await query("SELECT id FROM products WHERE id = $1", [id])
  if (!existing.rowCount) throw new HttpError(404, "No se encontró el producto")

  const values = [
    input.name,
    input.detail,
    input.description,
    input.price,
    input.available !== false,
    input.discount || 0,
    input.readyDays || 0,
  ]
  let sql = `UPDATE products
    SET name = $1, detail = $2, description = $3, price = $4,
        available = $5, discount = $6, ready_days = $7`
  if (input.image !== undefined) {
    values.push(toBytes(input.image))
    sql += `, image = $${values.length}, image_updated = now()`
  }
  values.push(id)
  sql += ` WHERE id = $${values.length}`
  await query(sql, values)
  return readStore()
}

export async function deleteProduct(id) {
  const result = await query("DELETE FROM products WHERE id = $1", [id])
  if (!result.rowCount) throw new HttpError(404, "No se encontró el producto")
  return readStore()
}

async function ensureStore() {
  await ensureSchema()
  const existing = await query("SELECT id FROM store_settings WHERE id = $1", [STORE_ID])
  if (existing.rowCount) return

  const initial = localCatalog()
  const cover = initial.cover || seed.cover
  await query(
    `INSERT INTO store_settings
      (id, name, whatsapp, cover_title, cover_subtitle, cover_image, cover_focus_x, cover_focus_y)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      STORE_ID,
      "Pródigo",
      initial.whatsapp || "",
      cover.title || seed.cover.title,
      cover.subtitle || seed.cover.subtitle,
      toBytes(cover.image),
      Number.isFinite(cover.focusX) ? cover.focusX : 50,
      Number.isFinite(cover.focusY) ? cover.focusY : 50,
    ],
  )

  for (const [index, product] of (initial.products || seed.products).entries()) {
    await query(
      `INSERT INTO products
        (id, name, detail, description, price, image, available, discount, ready_days, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        product.id,
        product.name,
        product.detail || "",
        product.description || "",
        product.price,
        toBytes(product.image),
        product.available !== false,
        product.discount || 0,
        product.readyDays || 0,
        index,
      ],
    )
  }
}

function localCatalog() {
  const file = path.join(import.meta.dirname, "store.json")
  if (!fs.existsSync(file)) return seed
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return seed
  }
}
