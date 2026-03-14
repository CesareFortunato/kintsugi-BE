const connection = require("../data/db");
const { sendOrderEmail } = require("../services/mailService");

async function store(req, res) {
  try {
    const { customer, shipping, billing, items } = req.body;

    let subtotal = 0;
    const itemsToInsert = [];

    items.forEach((item) => {
      const discountedPrice = item.price * (1 - (item.discount_value || 0) / 100);
      subtotal += discountedPrice * item.qty;
      itemsToInsert.push([null, item.id, item.name, item.qty, discountedPrice]);
    });

    const shippingCost = subtotal >= 200 ? 0 : 5;
    const total = subtotal + shippingCost;

    const sqlOrder = `
      INSERT INTO orders 
        (customer_email, customer_first_name, customer_last_name, subtotal, shipping, total, status, placed_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())
    `;

    connection.query(
      sqlOrder,
      [
        customer.email,
        customer.firstName,
        customer.lastName,
        subtotal,
        shippingCost,
        total,
      ],
      (err, result) => {
        if (err) {
          console.error("ERRORE SQL ORDINE:", err);
          return res.status(500).json({ error: "Errore Ordine" });
        }

        const orderId = result.insertId;

        const sqlShipping = `
          INSERT INTO order_shipping_addresses 
            (order_id, country, city, postal_code, address_line1) 
          VALUES (?, ?, ?, ?, ?)
        `;
        connection.query(
          sqlShipping,
          [
            orderId,
            shipping.country,
            shipping.city,
            shipping.zip,
            shipping.address,
          ],
          () => {
            const sqlBilling = `
              INSERT INTO order_billing_addresses 
                (order_id, country, city, postal_code, address_line1, vat_number) 
              VALUES (?, ?, ?, ?, ?, ?)
            `;
            connection.query(
              sqlBilling,
              [
                orderId,
                billing.country,
                billing.city,
                billing.zip,
                billing.address,
                billing.vat || "",
              ],
              () => {
                const finalItems = itemsToInsert.map((row) => {
                  row[0] = orderId;
                  return row;
                });

                const sqlItems = `
                  INSERT INTO order_items 
                    (order_id, product_id, product_name, qty, unit_price) 
                  VALUES ?
                `;

                connection.query(sqlItems, [finalItems], async (err) => {
                  if (err) {
                    console.error("ERRORE SQL ITEMS:", err);
                    return res.status(500).json({ error: "Errore Prodotti" });
                  }

                  console.log("INVIO EMAIL CLIENTE E VENDITORE");

                  // invio mail in try/catch per non bloccare il checkout
                  try {
                    await sendOrderEmail({
                      id: orderId,
                      email: customer.email, // cliente
                      name: `${customer.firstName} ${customer.lastName}`,
                      address: `${shipping.address}, ${shipping.city}, ${shipping.country}, ${shipping.zip}`,
                      total: total,
                      products: items.map(item => ({
                        name: item.name,
                        price: (item.price * (1 - (item.discount_value || 0) / 100)).toFixed(2),
                        qty: item.qty
                      }))
                    });
                    console.log("EMAIL INVIATE ALLA STESSA INBOX SVILUPPO");
                  } catch (mailError) {
                    console.error("ERRORE INVIO MAIL:", mailError);
                  }

                  res.status(201).json({
                    message: "Ordine creato con successo!",
                    orderId,
                    prezzoFinale: total.toFixed(2)
                  });
                });
              },
            );
          },
        );
      },
    );
  } catch (err) {
    console.error("ERRORE CHECKOUT GENERALE:", err);
    res.status(500).json({ error: "Errore durante il checkout" });
  }
}

function show(req, res) {
  const { id } = req.params;
  const sqlOrder = `SELECT * FROM orders WHERE id = ?`;
  connection.query(sqlOrder, [id], (err, orderResults) => {
    if (err || orderResults.length === 0) {
      return res.status(404).json({ error: "Ordine non trovato" });
    }
    const order = orderResults[0];
    const sqlShipping = `SELECT * FROM order_shipping_addresses WHERE order_id = ?`;
    connection.query(sqlShipping, [id], (err, shippingResults) => {
      const sqlItems = `SELECT * FROM order_items WHERE order_id = ?`;
      connection.query(sqlItems, [id], (err, itemsResults) => {
        res.json({
          order: order,
          shipping: shippingResults[0],
          items: itemsResults,
        });
      });
    });
  });
}

module.exports = { store, show };