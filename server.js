import "dotenv/config"
import cors from "cors"
import express from "express"
import {
  createProduct,
  deleteProduct,
  readCoverImage,
  readProductImage,
  readStore,
  updateCover,
  updateProduct,
  updateWhatsapp,
} from "./data/catalog.js"
import { adminSetupAvailable, loginAdmin, registerAdmin, requireAuth } from "./lib/auth.js"
import { ensureSchema } from "./lib/db.js"
import { sendError } from "./lib/http.js"
import { parseCover, parseNewProduct, parseProductPatch, parseWhatsapp } from "./lib/validate.js"

const app = express()
const port = Number(process.env.PORT) || 3001

app.use(cors())
app.use(express.json({ limit: "2mb" }))

app.get("/", (_req, res) => {
  res.json({ ok: true })
})

app.get("/api/health", (_req, res) => {
  res.json({ ok: true })
})

app.get("/api/store", async (_req, res) => {
  try {
    res.json(await readStore())
  } catch (error) {
    sendError(res, error)
  }
})

app.get("/api/products", async (_req, res) => {
  try {
    const store = await readStore()
    res.json(store.products)
  } catch (error) {
    sendError(res, error)
  }
})

app.get("/api/admin/setup", async (_req, res) => {
  try {
    await ensureSchema()
    res.json({ available: await adminSetupAvailable() })
  } catch (error) {
    sendError(res, error)
  }
})

app.post("/api/admin/setup", async (req, res) => {
  try {
    await ensureSchema()
    res.status(201).json(await registerAdmin(req.body?.email, req.body?.password))
  } catch (error) {
    sendError(res, error)
  }
})

app.post("/api/login", async (req, res) => {
  try {
    await ensureSchema()
    res.json(await loginAdmin(String(req.body?.email || ""), String(req.body?.password || "")))
  } catch (error) {
    sendError(res, error)
  }
})

app.get("/api/cover/image", async (_req, res) => {
  try {
    const image = await readCoverImage()
    if (!image) {
      res.status(404).end()
      return
    }
    res.set("Content-Type", "image/jpeg")
    res.set("Cache-Control", "public, max-age=86400")
    res.send(image)
  } catch (error) {
    sendError(res, error)
  }
})

app.get("/api/products/:id/image", async (req, res) => {
  try {
    const image = await readProductImage(req.params.id)
    if (!image) {
      res.status(404).end()
      return
    }
    res.set("Content-Type", "image/jpeg")
    res.set("Cache-Control", "public, max-age=86400")
    res.send(image)
  } catch (error) {
    sendError(res, error)
  }
})

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ email: req.user.email })
})

app.put("/api/whatsapp", requireAuth, async (req, res) => {
  try {
    const whatsapp = parseWhatsapp(req.body?.whatsapp)
    res.json(await updateWhatsapp(whatsapp))
  } catch (error) {
    sendError(res, error)
  }
})

app.put("/api/cover", requireAuth, async (req, res) => {
  try {
    res.json(await updateCover(parseCover(req.body)))
  } catch (error) {
    sendError(res, error)
  }
})

app.post("/api/products", requireAuth, async (req, res) => {
  try {
    const product = parseNewProduct(req.body)
    res.status(201).json(await createProduct(product))
  } catch (error) {
    sendError(res, error)
  }
})

app.patch("/api/products/:id", requireAuth, async (req, res) => {
  try {
    const store = await readStore()
    const current = store.products.find((product) => product.id === req.params.id)
    if (!current) {
      res.status(404).json({ error: "No se encontró el producto" })
      return
    }
    const product = parseProductPatch(req.body, current)
    res.json(await updateProduct(req.params.id, product))
  } catch (error) {
    sendError(res, error)
  }
})

app.delete("/api/products/:id", requireAuth, async (req, res) => {
  try {
    res.json(await deleteProduct(req.params.id))
  } catch (error) {
    sendError(res, error)
  }
})

app.listen(port, "0.0.0.0", () => {
  console.log(`Pródigo API en http://localhost:${port}`)
})
