const jwt = require('jsonwebtoken');

// Klaim `type` membedakan access vs refresh token supaya satu token tidak
// bisa dipakai menyalahgunakan endpoint di ranah lain (mis. access token
// dikirim ke /auth/refresh-token, atau refresh token dipakai sebagai Bearer
// di endpoint biasa) meski ada perbedaan konfigurasi secret di deployment.
const TYPE_ACCESS = 'access';
const TYPE_REFRESH = 'refresh';

function signAccessToken(payload) {
  return jwt.sign({ ...payload, type: TYPE_ACCESS }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
  });
}

function signRefreshToken(payload) {
  return jwt.sign(
    { ...payload, type: TYPE_REFRESH },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' },
  );
}

function verifyAccessToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.type !== TYPE_ACCESS) {
    throw new jwt.JsonWebTokenError('invalid token type');
  }
  return decoded;
}

function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  if (decoded.type !== TYPE_REFRESH) {
    throw new jwt.JsonWebTokenError('invalid token type');
  }
  return decoded;
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
