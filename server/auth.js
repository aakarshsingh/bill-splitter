const crypto = require('crypto');

// Shared-password gate (HTTP Basic Auth; username is ignored).
// Disabled when APP_PASSWORD is unset, e.g. local dev.

function digest(value) {
  return crypto.createHash('sha256').update(value).digest();
}

function requirePassword(password) {
  if (!password) return (req, res, next) => next();
  const expected = digest(password);

  return (req, res, next) => {
    const [scheme, encoded] = (req.headers.authorization || '').split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      const supplied = decoded.slice(decoded.indexOf(':') + 1);
      if (crypto.timingSafeEqual(digest(supplied), expected)) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="Bill Splitter", charset="UTF-8"');
    res.status(401).send('Password required');
  };
}

module.exports = { requirePassword };
