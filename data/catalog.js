import fs from "node:fs"
import path from "node:path"
import { db, STORE_ID } from "../lib/firebaseAdmin.js"
import { HttpError } from "../lib/http.js"
import { makeId } from "../lib/validate.js"
import { seed } from "./seed.js"

function storeRef() {
  return db().collection("stores").doc(STORE_ID)
}

function productsRef() {
  return storeRef().collection("products")
}

export async function readStore() {
  await ensureStore()
  const storeSnapshot = await storeRef().get()
  const productsSnapshot = await productsRef().get()
  const products = productsSnapshot.docs
    .map(toProduct)
    .sort((a, b) => a.position - b.position)
    .map(({ position, ...product }) => product)

  const data = storeSnapshot.data() || {}
  const cover = data.cover || seed.cover
  return { cover, products, whatsapp: data.whatsapp || "" }
}

export async function updateWhatsapp(whatsapp) {
  await ensureStore()
  await storeRef().update({ whatsapp })
  return readStore()
}

export async function updateCover(image) {
  await ensureStore()
  await storeRef().update({ "cover.image": image })
  return readStore()
}

export async function createProduct(input) {
  await ensureStore()
  const current = await productsRef().get()
  const products = current.docs.map(toProduct)
  const id = makeId(input.name, products)
  const position = products.reduce((max, product) => Math.max(max, product.position), -1) + 1
  await productsRef().doc(id).set({
    name: input.name,
    detail: input.detail,
    description: input.description,
    price: input.price,
    image: input.image,
    position,
  })
  return readStore()
}

export async function updateProduct(id, input) {
  const ref = productsRef().doc(id)
  const snapshot = await ref.get()
  if (!snapshot.exists) {
    throw new HttpError(404, "No se encontró el producto")
  }
  await ref.update({
    name: input.name,
    detail: input.detail,
    description: input.description,
    price: input.price,
    image: input.image,
  })
  return readStore()
}

export async function deleteProduct(id) {
  const ref = productsRef().doc(id)
  const snapshot = await ref.get()
  if (!snapshot.exists) {
    throw new HttpError(404, "No se encontró el producto")
  }
  await ref.delete()
  return readStore()
}

async function ensureStore() {
  const snapshot = await storeRef().get()
  if (snapshot.exists) return

  const initial = localCatalog()
  await storeRef().set({
    name: "Pródigo",
    slug: STORE_ID,
    cover: {
      title: initial.cover?.title || seed.cover.title,
      subtitle: initial.cover?.subtitle || seed.cover.subtitle,
      image: initial.cover?.image || null,
    },
    whatsapp: initial.whatsapp || "",
  })

  const batch = db().batch()
  initial.products.forEach((product, index) => {
    batch.set(productsRef().doc(product.id), {
      name: product.name,
      detail: product.detail || "",
      description: product.description || "",
      price: product.price,
      image: product.image || null,
      position: index,
    })
  })
  await batch.commit()
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

function toProduct(snapshot) {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    name: data.name,
    detail: data.detail || "",
    description: data.description || "",
    price: data.price,
    image: data.image || null,
    position: Number.isFinite(data.position) ? data.position : 0,
  }
}
