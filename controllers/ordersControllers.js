const connection = require("../data/db");
const { connect } = require("../routes/ordersRoutes");

function store(req, res) {
  const { customer, cart, shipping, billing, totals } = req.body;

  const sqlOrder = `INSERT INTO orders 
            (customer_first_name, customer_last_name, customer_email, subtotal, shipping, discount, total, status, placed_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`;

  connection.query(
    sqlOrder,
    [
      customer.firstName,
      customer.lastName,
      customer.email,
      totals.subtotal,
      5.0,
      0,
      totals.total,
    ],
    (err, orderResult) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Errore creazione ordine" });
      }

      const orderId = orderResult.insertId;

      const sqlShipping = `INSERT INTO order_shipping_addresses 
                (order_id, country, city, postal_code, address_line1) VALUES (?, ?, ?, ?, ?)`;

      connection.query(
        sqlShipping,
        [
          orderId,
          shipping.country,
          shipping.city,
          shipping.zip,
          shipping.address,
        ],
        (err) => {
          if (err) {
            console.error(err);
            return res
              .status(500)
              .json({ error: "Errore indirizzo spedizione" });
          }

          const sqlBilling = `INSERT INTO order_billing_addresses 
                    (order_id, country, city, postal_code, address_line1, vat_number) 
                    VALUES (?, ?, ?, ?, ?, ?)`;

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
            (err) => {
              if (err) {
                console.error(err);
                return res
                  .status(500)
                  .json({ error: "Errore indirizzo fatturazione" });
              }

              let completedInserts = 0;
              let hasErrorOccurred = false;
              cart.forEach((item) => {
                const sqlItem = `INSERT INTO order_items 
        (order_id, product_id, product_name, qty, unit_price) 
        VALUES (?, ?, ?, ?, ?)`;

                connection.query(
                  sqlItem,
                  [orderId, item.id, item.name, item.qty, item.price],
                  (err) => {
                    if (err) {
                      console.error("ERRORE FOREIGN KEY O DB:", err.message);
                      if (!hasErrorOccurred) {
                        hasErrorOccurred = true;
                        return res.status(400).json({
                          error:
                            "Impossibile creare l'ordine: uno dei prodotti non esiste o i dati sono errati.",
                          details: err.message,
                        });
                      }
                      return;
                    }

                    completedInserts++;
                    if (completedInserts === cart.length && !hasErrorOccurred) {
                      return res.status(201).json({
                        message: "Ordine completato con successo!",
                        orderId,
                      });
                    }
                  },
                );
              });
            },
          );
        },
      );
    },
  );
}

module.exports = { store };
