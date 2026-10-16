export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function sendError(res, error) {
  const status = error.status || 500
  res.status(status).json({
    error: status === 500 ? "No se pudo completar la acción" : error.message,
  })
}
