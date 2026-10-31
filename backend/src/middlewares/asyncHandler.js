// Membungkus controller async agar error otomatis diteruskan ke error middleware
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
