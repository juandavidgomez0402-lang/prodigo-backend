export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function sendError(res, error) {
  if (isMissingDatabase(error)) {
    res.status(503).json({
      error: "Firestore no está creado en el proyecto. Actívalo en Firebase, en modo nativo.",
    })
    return
  }
  const status = error.status || 500
  res.status(status).json({
    error: status === 500 ? "No se pudo completar la acción" : error.message,
  })
}

function isMissingDatabase(error) {
  const message = String(error.message || "")
  return error.code === 5 || error.code === "NOT_FOUND" || message.includes("NOT_FOUND")
}
