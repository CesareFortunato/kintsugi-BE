const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

transporter.verify((error, success) => {
  if (error) console.error("❌ Errore SMTP:", error);
  else console.log("✅ SMTP connesso correttamente");
});

async function sendOrderEmail(order) {
  try {
    const productsList = (order.products || [])
      .map(p => `<li>${p.name} - ${p.qty} x ${p.price}€</li>`)
      .join('');

    // Email cliente
    await transporter.sendMail({
      from: '"Kintsugi Essence" <no-reply@kintsugi.com>',
      to: order.email,
      subject: `Conferma ordine #${order.id} (Cliente)`,
      html: `
        <div style="font-family: Arial,sans-serif; max-width:600px; margin:auto; background:#fff; border:1px solid #e6e6e6; border-radius:8px;">
          <div style="background:#C6A95D; color:#fff; text-align:center; padding:20px;">
            <h1>Kintsugi Essence</h1>
          </div>
          <div style="padding:20px; color:#333;">
            <h2 style="color:#C6A95D;">Grazie per il tuo ordine!</h2>
            <p>Ciao <strong>${order.name}</strong>,</p>
            <h3>Riepilogo ordine</h3>
            <ul>${productsList}</ul>
            <p><strong>Totale:</strong> ${order.total.toFixed(2)}€</p>
            <h3>Indirizzo di spedizione</h3>
            <p>${order.address}</p>
          </div>
          <div style="background:#f5f5f5; color:#777; text-align:center; padding:15px; font-size:12px;">
            Kintsugi Essence - Fragranze artigianali
          </div>
        </div>
      `
    });

    // Email venditore
    await transporter.sendMail({
      from: '"Kintsugi Essence" <no-reply@kintsugi.com>',
      to: process.env.MAIL_USER,
      subject: `Nuovo ordine ricevuto #${order.id} (Venditore)`,
      html: `
        <h2>Nuovo ordine ricevuto</h2>
        <p><strong>Numero ordine:</strong> ${order.id}</p>
        <p><strong>Cliente:</strong> ${order.name}</p>
        <p><strong>Email cliente:</strong> ${order.email}</p>
        <p><strong>Totale:</strong> ${order.total.toFixed(2)}€</p>
        <h3>Riepilogo prodotti</h3>
        <ul>${productsList}</ul>
        <h3>Indirizzo di spedizione</h3>
        <p>${order.address}</p>
      `
    });

    console.log("📨 Email cliente e venditore inviate correttamente");
  } catch (err) {
    console.error("❌ Errore invio email:", err);
    throw err;
  }
}

module.exports = { sendOrderEmail };