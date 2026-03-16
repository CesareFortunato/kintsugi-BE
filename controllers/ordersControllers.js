const connection = require("../data/db");
function store(req, res) {
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

  const sqlOrder = `INSERT INTO orders (customer_email, customer_first_name, customer_last_name, subtotal, shipping, total, status, placed_at) 
                    VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`;

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
      if (err) return res.status(500).json({ error: "Errore Ordine" });

      const orderId = result.insertId;

      const sqlShipping = `INSERT INTO order_shipping_addresses (order_id, country, city, postal_code, address_line1) VALUES (?, ?, ?, ?, ?)`;
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
          const sqlBilling = `INSERT INTO order_billing_addresses (order_id, country, city, postal_code, address_line1, vat_number) VALUES (?, ?, ?, ?, ?, ?)`;
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

              const sqlItems = `INSERT INTO order_items (order_id, product_id, product_name, qty, unit_price) VALUES ?`;

              connection.query(sqlItems, [finalItems], (err) => {
                if (err)
                  return res.status(500).json({ error: "Errore Prodotti" });

                res.status(201).json({
                  message: "Ordine creato con successo!",
                  orderId,
                  prezzoFinale: total.toFixed(2),
                });
              });
            },
          );
        },
      );
    },
  );
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
