const connection = require("../data/db");
const { sendOrderEmail } = require("../services/mailService");

async function store(req, res) {
  try {
    // Estrae i dati principali inviati dal frontend
    const { customer, shipping, billing, items } = req.body;

    // Controllo base del payload
    if (
      !customer ||
      !shipping ||
      !billing ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({ error: "Dati ordine mancanti o non validi" });
    }

    // Recupera tutti gli id prodotto ricevuti dal frontend
    const productIds = items.map((item) => item.id);

    // Query per leggere i prodotti reali dal DB
    const sqlProducts = `
      SELECT id, name, price, discount_value
      FROM products
      WHERE id IN (?)
    `;

    connection.query(sqlProducts, [productIds], (err, productResults) => {
      if (err) {
        console.error("ERRORE SQL PRODOTTI:", err);
        return res.status(500).json({ error: "Errore recupero prodotti" });
      }

      // Se non trova nessun prodotto valido, blocca il checkout
      if (!productResults.length) {
        return res.status(400).json({ error: "Nessun prodotto valido trovato" });
      }

      // Variabili per totale ordine, righe da inserire e prodotti per email
      let subtotal = 0;
      const itemsToInsert = [];
      const emailProducts = [];

      // Scorre gli items ricevuti dal frontend
      items.forEach((item) => {
        // Cerca il prodotto reale corrispondente nel DB
        const productFromDb = productResults.find(
          (product) => product.id === item.id
        );

        // Se un prodotto non viene trovato, lo salta
        if (!productFromDb) return;

        // Quantità ordinata
        const quantity = item.qty;

        // Prezzo base e sconto letti dal DB
        const price = productFromDb.price;
        const discountValue = productFromDb.discount_value || 0;

        // Calcola il prezzo scontato lato backend
        const discountedPrice = price * (1 - discountValue / 100);

        // Aggiorna il subtotale
        subtotal += discountedPrice * quantity;

        // Prepara la riga per la tabella order_items
        itemsToInsert.push([
          null, // order_id verrà inserito dopo
          productFromDb.id,
          productFromDb.name,
          quantity,
          discountedPrice,
        ]);

        // Prepara i dati prodotto per l'email ordine
        emailProducts.push({
          name: productFromDb.name,
          price: discountedPrice.toFixed(2),
          qty: quantity,
        });
      });

      // Se nessun item è valido, blocca il checkout
      if (itemsToInsert.length === 0) {
        return res.status(400).json({ error: "Prodotti ordine non validi" });
      }

      // Calcola spedizione e totale finali lato backend
      const shippingCost = subtotal >= 200 ? 0 : 5;
      const total = subtotal + shippingCost;

      // Controllo di sicurezza sui totali
      if (isNaN(subtotal) || isNaN(total)) {
        return res.status(400).json({ error: "Totali ordine non validi" });
      }

      // Inserisce il record principale dell'ordine
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

          // Recupera l'id del nuovo ordine creato
          const orderId = result.insertId;

          // Inserisce l'indirizzo di spedizione
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
            (err) => {
              if (err) {
                console.error("ERRORE SQL SHIPPING:", err);
                return res
                  .status(500)
                  .json({ error: "Errore indirizzo spedizione" });
              }

              // Inserisce l'indirizzo di fatturazione
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
                (err) => {
                  if (err) {
                    console.error("ERRORE SQL BILLING:", err);
                    return res
                      .status(500)
                      .json({ error: "Errore indirizzo fatturazione" });
                  }

                  // Inserisce l'orderId in ogni riga dei prodotti ordine
                  const finalItems = itemsToInsert.map((row) => {
                    row[0] = orderId;
                    return row;
                  });

                  // Inserisce tutti i prodotti acquistati nella tabella order_items
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

                    // Invia le email senza bloccare il checkout in caso di errore mail
                    try {
                      await sendOrderEmail({
                        id: orderId,
                        email: customer.email,
                        name: `${customer.firstName} ${customer.lastName}`,
                        address: `${shipping.address}, ${shipping.city}, ${shipping.country}, ${shipping.zip}`,
                        total: total,
                        products: emailProducts,
                      });

                      console.log("EMAIL INVIATE ALLA STESSA INBOX SVILUPPO");
                    } catch (mailError) {
                      console.error("ERRORE INVIO MAIL:", mailError);
                    }

                    // Risposta finale al frontend
                    res.status(201).json({
                      message: "Ordine creato con successo!",
                      orderId,
                      prezzoFinale: total.toFixed(2),
                    });
                  });
                }
              );
            }
          );
        }
      );
    });
  } catch (err) {
    console.error("ERRORE CHECKOUT GENERALE:", err);
    res.status(500).json({ error: "Errore durante il checkout" });
  }
}

function show(req, res) {
  // Recupera l'id ordine dai parametri
  const { id } = req.params;

  // Query ordine principale
  const sqlOrder = `SELECT * FROM orders WHERE id = ?`;

  connection.query(sqlOrder, [id], (err, orderResults) => {
    if (err || orderResults.length === 0) {
      return res.status(404).json({ error: "Ordine non trovato" });
    }

    // Salva il record ordine trovato
    const order = orderResults[0];

    // Query indirizzo di spedizione
    const sqlShipping = `
      SELECT * FROM order_shipping_addresses WHERE order_id = ?
    `;

    connection.query(sqlShipping, [id], (err, shippingResults) => {
      if (err) {
        return res.status(500).json({ error: "Errore recupero spedizione" });
      }

      // Query prodotti associati all'ordine
      const sqlItems = `SELECT * FROM order_items WHERE order_id = ?`;

      connection.query(sqlItems, [id], (err, itemsResults) => {
        if (err) {
          return res.status(500).json({ error: "Errore recupero prodotti ordine" });
        }

        // Restituisce ordine completo al frontend
        res.json({
          order,
          shipping: shippingResults[0],
          items: itemsResults,
        });
      });
    });
  });
}

module.exports = { store, show };