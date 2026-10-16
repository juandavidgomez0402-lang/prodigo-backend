import { HttpError } from "./http.js"

const PRODUCT_IMAGE_MAX = 200_000
const COVER_IMAGE_MAX = 360_000

export function parseNewProduct(body) {
  return {
    name: parseName(body?.name),
    detail: parseDetail(body?.detail),
    description: parseDescription(body?.description),
    price: parsePrice(body?.price),
    image: parseImage(body?.image, PRODUCT_IMAGE_MAX),
    available: body?.available === undefined ? true : parseAvailable(body.available),
    discount: parseDiscount(body?.discount, 0),
    readyDays: parseReadyDays(body?.readyDays, 0),
  }
}

export function parseProductPatch(body, current) {
  return {
    id: current.id,
    name: body?.name === undefined ? current.name : parseName(body.name),
    detail: body?.detail === undefined ? current.detail : parseDetail(body.detail),
    description:
      body?.description === undefined ? current.description || "" : parseDescription(body.description),
    price: body?.price === undefined ? current.price : parsePrice(body.price),
    image: parseStoredImage(body?.image, PRODUCT_IMAGE_MAX),
    available: body?.available === undefined ? current.available !== false : parseAvailable(body.available),
    discount: body?.discount === undefined ? current.discount || 0 : parseDiscount(body.discount),
    readyDays: body?.readyDays === undefined ? current.readyDays || 0 : parseReadyDays(body.readyDays),
  }
}

export function parseWhatsapp(value) {
  const digits = String(value ?? "").replace(/\D/g, "")
  if (digits.length < 10 || digits.length > 15) {
    throw new HttpError(400, "Ingresa el WhatsApp con indicativo, por ejemplo 573001234567")
  }
  return digits
}

export function parseCover(body) {
  if (!body || (body.image === undefined && body.focusX === undefined && body.focusY === undefined)) {
    throw new HttpError(400, "Falta la foto de portada")
  }
  return {
    image: parseStoredImage(body.image, COVER_IMAGE_MAX),
    focusX: parseFocus(body?.focusX),
    focusY: parseFocus(body?.focusY),
  }
}

function parseStoredImage(value, maxChars) {
  if (value === undefined) return undefined
  if (typeof value === "string" && (value.startsWith("/api/") || value.startsWith("http"))) {
    return undefined
  }
  return parseImage(value, maxChars)
}

function parseFocus(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 50
  return Math.min(100, Math.max(0, Math.round(number * 10) / 10))
}

export function makeId(name, products) {
  const base =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "producto"

  const taken = new Set(products.map((product) => product.id))
  let id = base
  while (taken.has(id)) {
    id = `${base}-${Math.random().toString(36).slice(2, 6)}`
  }
  return id
}

function parseName(value) {
  const name = clean(value)
  if (name.length < 2 || name.length > 60) {
    throw new HttpError(400, "El nombre debe tener entre 2 y 60 caracteres")
  }
  return name
}

function parseDetail(value) {
  const detail = clean(value)
  if (detail.length > 80) {
    throw new HttpError(400, "El detalle es demasiado largo")
  }
  return detail
}

function parseDescription(value) {
  const description = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .trim()
  if (description.length > 2000) {
    throw new HttpError(400, "La descripción es demasiado larga")
  }
  return description
}

function parseAvailable(value) {
  if (value === true || value === "true" || value === "disponible") return true
  if (value === false || value === "false" || value === "agotado") return false
  throw new HttpError(400, "Marca el producto como disponible o agotado")
}

function parseDiscount(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback
  const discount = Math.round(Number(value))
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    throw new HttpError(400, "El descuento debe estar entre 0 y 100")
  }
  return discount
}

function parseReadyDays(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback
  const days = Math.floor(Number(value))
  if (!Number.isFinite(days) || days < 0 || days > 365) {
    throw new HttpError(400, "Los días de preparación deben estar entre 0 y 365")
  }
  return days
}

function parsePrice(value) {
  const digits = String(value ?? "").replace(/[.\s]/g, "")
  if (!/^\d+$/.test(digits)) {
    throw new HttpError(400, "El precio debe ser un número entero en pesos")
  }
  const price = Number(digits)
  if (price < 1 || price > 99_999_999) {
    throw new HttpError(400, "El precio no es válido")
  }
  return price
}

function parseImage(value, maxChars) {
  if (value == null || value === "") return null
  if (typeof value !== "string" || !value.startsWith("data:image/jpeg;base64,")) {
    throw new HttpError(400, "La foto debe guardarse como JPEG comprimido")
  }
  if (value.length > maxChars) {
    throw new HttpError(400, "La foto es demasiado pesada")
  }
  return value
}

function clean(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
}
