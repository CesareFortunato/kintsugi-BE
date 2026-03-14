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
        <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; background:#fff; border:1px solid #e6e6e6; border-radius:8px; overflow:hidden;">
          <div style="background:#C6A95D; color:#fff; text-align:center; padding:20px 0;">
            <h1 style="margin:0; font-size:28px;">Kintsugi Essence</h1>
          </div>
          <div style="padding:20px; color:#333;">
            <h2 style="color:#C6A95D;">Grazie per il tuo ordine!</h2>
            <p>Ciao <strong>${order.name}</strong>,</p>
            <h3>Riepilogo ordine</h3>
            <ul>
              ${order.products.map(p => `<li>${p.name} - ${p.qty} x ${p.price}€</li>`).join('')}
            </ul>
            <p><strong>Totale:</strong> ${order.total}€</p>
            <h3>Indirizzo di spedizione</h3>
            <p>${order.address}</p>
          </div>
          <div style="background:#f5f5f5; color:#777; text-align:center; padding:15px; font-size:12px;">
            Kintsugi Essence - Fragranze artigianali ispirate a storie senza tempo
          </div>
        </div>
      `
    });
  } catch (err) {
    console.error("MAIL ERROR:", err);
    throw err;
  }
}

module.exports = { sendOrderEmail };