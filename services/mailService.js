const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});


async function sendOrderEmail(order) {
  try {
    await transporter.sendMail({
      from: '"Kintsugi Essence" <no-reply@kintsugi.com>',
      to: order.email,
      subject: `Conferma ordine #${order.id}`,
      html: `
        <h2>Grazie per il tuo ordine</h2>
        <p>Numero ordine: ${order.id}</p>
        <p>Totale: ${order.total}€</p>
      `
    });
  } catch (err) {
    console.error("MAIL ERROR:", err);
    throw err; // così il checkout lo vede
  }
}


module.exports = { sendOrderEmail };