const nodemailer = require("nodemailer");

// Konfigurasi SMTP dibaca dari .env:
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM
// Untuk Gmail: gunakan App Password (bukan password akun biasa), host
// smtp.gmail.com, port 587, SMTP_SECURE=false.
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return transporter;
}

/**
 * Mengirim satu email. Melempar error jika gagal - pemanggil bertanggung
 * jawab menanganinya (mis. membalas 500 ke client tanpa membocorkan detail).
 */
async function sendMail({ to, subject, html }) {
  const from =
    process.env.SMTP_FROM ||
    "BUMDESMA Podo Rukun LKD <no-reply@bumdesma.local>";
  return getTransporter().sendMail({ from, to, subject, html });
}

module.exports = { sendMail };
