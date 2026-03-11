const connection = require("../data/db");

function store(req, res) {
  //proprietà che inserite nella richiesa
  const { customer, shipping, billing, totals } = req.body;

  //inserisco in orders i valori del db, messo pending al momento e NOW() mi stamperà nel db
  //il momento esatto in cui è avvenuto l'ordine
  const sqlOrder = `INSERT INTO orders 
            (customer_first_name, customer_last_name, customer_email, subtotal, shipping, discount, total, status, placed_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`;

  //passo nella query tutto 5.0 è un prezzo di spedizione fittizio
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
      //gestione errore
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Errore creazione ordine" });
      }

      //salvo id per il collegamento con gli indirizzi
      const orderId = orderResult.insertId;

      //preparazione query
      const sqlShipping = `INSERT INTO order_shipping_addresses 
                (order_id, country, city, postal_code, address_line1) VALUES (?, ?, ?, ?, ?)`;

      //Passo i dati dalla richiesta tra cui l'id dell'ordine
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
            //Gestione errore
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

              return res.status(201).json({
                message: "Ordine creato con successo!",
                orderId: orderId,
              });
            },
          );
        },
      );
    },
  );
}

module.exports = { store };
