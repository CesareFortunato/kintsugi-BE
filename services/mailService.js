const nodemailer = require("nodemailer");

// 🔧 CONFIGURAZIONE SMTP (Mailtrap)
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: false, // 🔥 OBBLIGATORIO per Mailtrap
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// 🔍 TEST CONNESSIONE SMTP
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Errore SMTP:", error);
  } else {
    console.log("✅ Connessione SMTP OK - Mailtrap pronto");
  }
});

async function sendOrderEmail(order) {
  try {
    console.log("MAIL_USER:", process.env.MAIL_USER);
    const productsList = (order.products || [])
      .map(p => `<li>${p.name} - ${p.qty} x ${p.price}€</li>`)
      .join('');
      

    // 📧 EMAIL AL CLIENTE
    await transporter.sendMail({
      from: '"Kintsugi Essence" <no-reply@kintsugi.com>',
      to: process.env.MAIL_USER, // stessa inbox Mailtrap
      subject: `Conferma ordine #${order.id} (Cliente)`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width:600px; margin:auto; background:#fff; border:1px solid #e6e6e6; border-radius:8px; overflow:hidden;">
          <div style="background:#C6A95D; color:#fff; text-align:center; padding:20px 0;">
            <h1 style="margin:0; font-size:28px;">Kintsugi Essence</h1>
          </div>
          <div style="padding:20px; color:#333;">
            <h2 style="color:#C6A95D;">Grazie per il tuo ordine!</h2>
            <p>Ciao <strong>${order.name || "Cliente"}</strong>,</p>
            <h3>Riepilogo ordine</h3>
            <ul>${productsList}</ul>
            <p><strong>Totale:</strong> ${order.total}€</p>
            <h3>Indirizzo di spedizione</h3>
            <p>${order.address || ""}</p>
          </div>
          <div style="background:#f5f5f5; color:#777; text-align:center; padding:15px; font-size:12px;">
            Kintsugi Essence - Fragranze artigianali ispirate a storie senza tempo
          </div>
        </div>
      `
    });

    // 📧 EMAIL AL VENDITORE
    await transporter.sendMail({
      from: '"Kintsugi Essence" <no-reply@kintsugi.com>',
      to: process.env.MAIL_USER, // stessa inbox Mailtrap
      subject: `Nuovo ordine ricevuto #${order.id} (Venditore)`,
      html: `
        <h2>Nuovo ordine ricevuto</h2>
        <p><strong>Numero ordine:</strong> ${order.id}</p>
        <p><strong>Cliente:</strong> ${order.name || "Non disponibile"}</p>
        <p><strong>Email cliente:</strong> ${order.email}</p>
        <p><strong>Totale:</strong> ${order.total}€</p>
        <h3>Riepilogo prodotti</h3>
        <ul>${productsList}</ul>
        <h3>Indirizzo di spedizione</h3>
        <p>${order.address || ""}</p>
      `
    });

    console.log("📨 Email cliente e venditore inviate correttamente");

  } catch (err) {
    console.error("❌ MAIL ERROR:", err);
    throw err;
  }
}

module.exports = { sendOrderEmail };