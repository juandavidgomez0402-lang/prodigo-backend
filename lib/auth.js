import { adminAuth, db, STORE_ID } from "./firebaseAdmin.js"
import { HttpError } from "./http.js"

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ""
    const token = header.startsWith("Bearer ") ? header.slice(7) : ""
    if (!token) {
      throw new HttpError(401, "Inicia sesión para continuar")
    }

    const payload = await adminAuth().verifyIdToken(token)
    const profile = await loadProfile(payload)
    if (profile.role !== STORE_ID || profile.storeId !== STORE_ID) {
      throw new HttpError(
        403,
        "Esta cuenta no tiene el rol prodigo y solo puede personalizar esa tienda.",
      )
    }

    req.user = profile
    next()
  } catch (error) {
    if (error.status) {
      res.status(error.status).json({ error: error.message })
      return
    }
    res.status(401).json({ error: "La sesión no es válida" })
  }
}

async function loadProfile(payload) {
  const snapshot = await db()
    .collection("stores")
    .doc(STORE_ID)
    .collection("admins")
    .doc(payload.uid)
    .get()
  const data = snapshot.exists ? snapshot.data() : {}
  return {
    uid: payload.uid,
    email: data.email || payload.email || "",
    role: data.role || payload.role || "",
    storeId: data.storeId || payload.storeId || "",
  }
}
