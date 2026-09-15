export function securityHeaders(nonce: string, secureProduction: boolean) {
  const scriptSource = secureProduction
    ? `'nonce-${nonce}' 'strict-dynamic'`
    : `'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`;
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' ${scriptSource}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(secureProduction ? ["upgrade-insecure-requests"] : [])
  ].join("; ");

  return {
    "Content-Security-Policy": contentSecurityPolicy,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "X-Frame-Options": "DENY",
    ...(secureProduction
      ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" }
      : {})
  };
}
