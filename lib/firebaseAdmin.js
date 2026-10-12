import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

const backendRoot = path.join(import.meta.dirname, "..")

function escapeNewlinesInsideStrings(text) {
  let out = ""
  let inString = false
  let escaped = false
  for (const char of text) {
    if (!inString) {
      if (char === '"') inString = true
      out += char
      continue
    }
    if (escaped) {
      out += char
      escaped = false
      continue
    }
    if (char === "\\") {
      out += char
      escaped = true
      continue
    }
    if (char === '"') {
      inString = false
      out += char
      continue
    }
    if (char === "\n") {
      out += "\\n"
      continue
    }
    if (char === "\r") continue
    out += char
  }
  return out
}

function parseServiceAccount(raw) {
  let text = raw.trim().replace(/^\uFEFF/, "")
  const quotedObject =
    (text.startsWith("'") && text.endsWith("'") && text.slice(1, -1).trim().startsWith("{")) ||
    (text.startsWith('"') && text.endsWith('"') && text.slice(1, -1).trim().startsWith("{"))
  if (quotedObject) text = text.slice(1, -1).trim()
  if (!text.startsWith("{")) text = `{${text}}`
  if (!text.endsWith("}")) text = `${text}}`
  try {
    return JSON.parse(escapeNewlinesInsideStrings(text))
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT no es un JSON válido. Pega el archivo completo, desde { hasta }.",
    )
  }
}

function serviceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT
  if (raw) {
    return parseServiceAccount(raw)
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }
  }

  return null
}

function serviceAccountFromFile() {
  const configured = process.env.GOOGLE_APPLICATION_CREDENTIALS
  const credentialFile = path.resolve(
    backendRoot,
    configured || "prodigo-b1924-firebase-adminsdk-fbsvc-95ee5f4cc9.json",
  )
  if (!existsSync(credentialFile)) return null
  return JSON.parse(readFileSync(credentialFile, "utf8"))
}

function loadServiceAccount() {
  const fromEnv = serviceAccountFromEnv()
  if (fromEnv) return fromEnv

  const fromFile = serviceAccountFromFile()
  if (fromFile) return fromFile

  throw new Error(
    "Faltan las credenciales de Firebase. En Render define FIREBASE_SERVICE_ACCOUNT con el JSON de la cuenta de servicio.",
  )
}

if (getApps().length === 0) {
  initializeApp({ credential: cert(loadServiceAccount()) })
}

export const STORE_ID = "prodigo"

export function adminAuth() {
  return getAuth()
}

export function db() {
  return getFirestore()
}
