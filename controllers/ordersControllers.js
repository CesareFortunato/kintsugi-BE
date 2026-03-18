const connection = require("../data/db");
const { sendOrderEmail } = require("../services/mailService");

async function store(req, res) {
  try {
    const { customer, shipping, billing, items } = req.body;
    if (!customer || !shipping || !billing || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Dati ordine mancanti o non validi" });
    }

    const productIds = items.map(i => i.id);
    const sqlProducts = `
      SELECT id, name, price, discount_value
      FROM products
      WHERE id IN (?)
    `;

    connection.query(sqlProducts, [productIds], (err, productResults) => {
      if (err) return res.status(500).json({ error: "Errore DB prodotti" });
      if (!productResults.length) return res.status(400).json({ error: "Prodotti non validi" });

      let subtotal = 0;
      const itemsToInsert = [];
      const emailProducts = [];

      items.forEach(item => {
        const productFromDb = productResults.find(p => p.id === item.id);
        if (!productFromDb) return;

        const price = productFromDb.price;
        const discount = productFromDb.discount_value || 0;
        const discountedPrice = price * (1 - discount / 100);
        subtotal += discountedPrice * item.qty;

        itemsToInsert.push([null, productFromDb.id, productFromDb.name, item.qty, discountedPrice]);
        emailProducts.push({ name: productFromDb.name, price: discountedPrice.toFixed(2), qty: item.qty });
      });

      const shippingCost = subtotal >= 200 ? 0 : 5;
      const total = subtotal + shippingCost;

      const sqlOrder = `
        INSERT INTO orders 
          (customer_email, customer_first_name, customer_last_name, subtotal, shipping, total, status, placed_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
      `;

      connection.query(sqlOrder, [customer.email, customer.firstName, customer.lastName, subtotal, shippingCost, total], (err, result) => {
        if (err) return res.status(500).json({ error: "Errore creazione ordine" });

        const orderId = result.insertId;
        const sqlShipping = `
          INSERT INTO order_shipping_addresses (order_id, country, city, postal_code, address_line1)
          VALUES (?, ?, ?, ?, ?)
        `;

        connection.query(sqlShipping, [orderId, shipping.country, shipping.city, shipping.zip, shipping.address], err => {
          if (err) return res.status(500).json({ error: "Errore shipping" });

          const sqlBilling = `
            INSERT INTO order_billing_addresses (order_id, country, city, postal_code, address_line1, vat_number)
            VALUES (?, ?, ?, ?, ?, ?)
          `;
          connection.query(sqlBilling, [orderId, billing.country, billing.city, billing.zip, billing.address, billing.vat || ""], async err => {
            if (err) return res.status(500).json({ error: "Errore billing" });

            const finalItems = itemsToInsert.map(row => { row[0] = orderId; return row; });
            const sqlItems = `INSERT INTO order_items (order_id, product_id, product_name, qty, unit_price) VALUES ?`;
            connection.query(sqlItems, [finalItems], async err => {
              if (err) return res.status(500).json({ error: "Errore prodotti ordine" });

              try {
                await sendOrderEmail({
                  id: orderId,
                  email: customer.email,
                  name: `${customer.firstName} ${customer.lastName}`,
                  address: `${shipping.address}, ${shipping.city}, ${shipping.country}, ${shipping.zip}`,
                  total: total,
                  products: emailProducts
                });
              } catch (mailErr) {
                console.error(mailErr);
              }

              res.status(201).json({ message: "Ordine creato con successo!", orderId, prezzoFinale: total.toFixed(2) });
            });
          });
        });
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore durante il checkout" });
  }
}

function show(req, res) {
  const { id } = req.params;
  const sqlOrder = `SELECT * FROM orders WHERE id = ?`;
  connection.query(sqlOrder, [id], (err, orderResults) => {
    if (err || orderResults.length === 0) return res.status(404).json({ error: "Ordine non trovato" });

    const order = orderResults[0];
    const sqlShipping = `SELECT * FROM order_shipping_addresses WHERE order_id = ?`;
    connection.query(sqlShipping, [id], (err, shippingResults) => {
      if (err) return res.status(500).json({ error: "Errore spedizione" });

      const sqlItems = `SELECT * FROM order_items WHERE order_id = ?`;
      connection.query(sqlItems, [id], (err, itemsResults) => {
        if (err) return res.status(500).json({ error: "Errore prodotti" });

        res.json({ order, shipping: shippingResults[0], items: itemsResults });
      });
    });
  });
}

module.exports = { store, show };