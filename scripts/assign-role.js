import "dotenv/config"
import { adminAuth, db, STORE_ID } from "../lib/firebaseAdmin.js"

const email = process.argv[2]
if (!email) {
  console.error("Uso: npm run assign-role -- correo@ejemplo.com")
  process.exit(1)
}

const user = await adminAuth().getUserByEmail(email)
await db().collection("stores").doc(STORE_ID).collection("admins").doc(user.uid).set(
  {
    email: user.email,
    role: STORE_ID,
    storeId: STORE_ID,
  },
  { merge: true },
)
await adminAuth().setCustomUserClaims(user.uid, {
  role: STORE_ID,
  storeId: STORE_ID,
})

console.log(`Rol ${STORE_ID} asignado a ${user.email}`)
