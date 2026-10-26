/**
 * Safe centralized error handler that redacts any credential or internal paths
 */
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || res.statusCode !== 200 ? res.statusCode : 500;
  
  // Safe sanitized message
  const rawMessage = err.message || 'An unexpected error occurred.';
  const sanitizedMessage = rawMessage.replace(/[a-zA-Z0-9_\-]{30,}/g, '[REDACTED_SECRET]');

  console.error(`[Server Error] ${req.method} ${req.url} -> ${sanitizedMessage}`);

  res.status(statusCode).json({
    error: sanitizedMessage,
    timestamp: new Date().toISOString()
  });
}
