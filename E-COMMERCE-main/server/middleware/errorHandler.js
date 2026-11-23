export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  let status = error.statusCode || error.status || 500;
  let message = error.message || 'An unexpected server error occurred.';
  let details;

  if (error.name === 'ValidationError') {
    status = 400;
    message = 'Request validation failed.';
    details = Object.values(error.errors).map((entry) => entry.message);
  } else if (error.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${error.path}.`;
  } else if (error.code === 11000) {
    status = 409;
    const field = Object.keys(error.keyPattern || {})[0] || 'field';
    message = `A record with this ${field} already exists.`;
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body must contain valid JSON.';
  }

  if (status >= 500) console.error(error);
  res.status(status).json({ success: false, message, ...(details ? { details } : {}), ...(process.env.NODE_ENV === 'development' && status >= 500 ? { stack: error.stack } : {}) });
}
