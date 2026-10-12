import { readFileSync } from "node:fs"
import path from "node:path"
import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

const backendRoot = path.join(import.meta.dirname, "..")
const credentialFile = path.resolve(
  backendRoot,
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    "prodigo-b1924-firebase-adminsdk-fbsvc-95ee5f4cc9.json",
)

if (getApps().length === 0) {
  const serviceAccount = JSON.parse(readFileSync(credentialFile, "utf8"))
  initializeApp({ credential: cert(serviceAccount) })
}

export const STORE_ID = "prodigo"

export function adminAuth() {
  return getAuth()
}

export function db() {
  return getFirestore()
}
