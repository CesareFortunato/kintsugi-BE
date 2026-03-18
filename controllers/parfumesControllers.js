const connection = require("../data/db");

function index(req, res) {
  // query per recuperare tutti i prodotti
  const sql = "SELECT * FROM products";

  // eseguiamo la query e gestiamo eventuali errori
  connection.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "Database query failed" });

    // aggiungiamo il path completo all'immagine principale di ogni prodotto
    results = results.map((product) => {
      return {
        ...product,
        product_image_url: product.product_image_url
          ? `http://localhost:3000/img/${product.product_image_url}`
          : null,
      };
    });

    // restituiamo la lista prodotti
    res.json(results);
  });
}

function show(req, res) {
  // recuperiamo lo slug pubblico dalla rotta
  const { public_slug } = req.params;

  // query per recuperare il singolo prodotto
  const productSql = "SELECT * FROM products WHERE public_slug = ?";

  connection.query(productSql, [public_slug], (err, productResult) => {
    if (err) return res.status(500).json({ error: "Database query failed" });

    // se il prodotto non esiste restituiamo 404
    if (productResult.length === 0) {
      return res.status(404).json({ error: "Profumo non trovato" });
    }

    // salviamo il prodotto trovato e il suo id
    const product = productResult[0];
    const productId = product.id;

    // formattiamo subito l'immagine principale del prodotto
    product.product_image_url = product.product_image_url
      ? `http://localhost:3000/img/${product.product_image_url}`
      : null;

    // query per recuperare le immagini collegate al prodotto
    const imagesSql = "SELECT * FROM product_images WHERE product_id = ?";

    connection.query(imagesSql, [productId], (err, imageResult) => {
      if (err) return res.status(500).json({ error: "Database query failed" });

      // formattiamo le immagini secondarie usando il path già salvato nel db
      // senza aggiungere "/img", così evitiamo duplicazioni tipo "/img/img/..."
      product.images = imageResult.map((image) => {
        let cleanUrl = image.url ? image.url.replace(/^\/+/, "") : null;

        // rimuoviamo "img/" se presente
        cleanUrl = cleanUrl ? cleanUrl.replace(/^img\//, "") : null;

        // rimuoviamo "products/" perché i file NON sono in quella cartella
        cleanUrl = cleanUrl ? cleanUrl.replace(/^products\//, "") : null;

        return {
          ...image,
          url: cleanUrl ? `http://localhost:3000/img/${cleanUrl}` : null,
        };
      });

      // query per recuperare le note collegate al prodotto
      const notesSql = `
        SELECT notes.* 
        FROM notes
        JOIN note_product ON notes.id = note_product.note_id
        WHERE note_product.product_id = ?
      `;

      connection.query(notesSql, [productId], (err, notesResult) => {
        if (err) {
          return res.status(500).json({ error: "Database query failed" });
        }

        // aggiungiamo le note al prodotto
        product.notes = notesResult;

        // restituiamo il prodotto completo
        res.json(product);
      });
    });
  });
}

// funzione per recuperare tutti i prodotti collegati a una nota specifica
function getNote(req, res) {
  // recuperiamo l'id nota dai parametri
  const { noteId } = req.params;

  // query per prendere tutti i prodotti che contengono quella nota
  const sql = `
    SELECT products.*
    FROM products
    JOIN note_product ON products.id = note_product.product_id
    WHERE note_product.note_id = ?
  `;

  connection.query(sql, [noteId], (err, productsResults) => {
    if (err) return res.status(500).json({ error: "Database query failed" });
    console.log(
      "Prodotti trovati nel DB:",
      productsResults.map((p) => p.name),
    );

    // se non troviamo prodotti restituiamo 404
    if (productsResults.length === 0) {
      return res.status(404).json({ message: "Nessun profumo trovato" });
    }

    // ricaviamo gli id dei prodotti trovati
    const productIds = productsResults.map((product) => product.id);

    // query per recuperare tutte le note dei prodotti trovati
    const notesSql = `
      SELECT notes.*, note_product.product_id 
      FROM notes
      JOIN note_product ON notes.id = note_product.note_id
      WHERE note_product.product_id IN (?)
    `;

    connection.query(notesSql, [productIds], (err, notesResults) => {
      if (err) return res.status(500).json({ error: "Nessun profumo trovato" });

      // per ogni prodotto aggiungiamo immagine completa e note collegate
      const results = productsResults.map((product) => {
        return {
          ...product,
          product_image_url: product.product_image_url
            ? `http://localhost:3000/img/${product.product_image_url}`
            : null,
          notes: notesResults.filter((n) => n.product_id === product.id),
        };
      });

      // restituiamo i prodotti formattati
      res.json(results);
    });
  });
}

function related(req, res) {
  // recuperiamo lo slug del prodotto corrente
  const { public_slug } = req.params;

  // query per trovare il prodotto di partenza
  const productSql = "SELECT * FROM products WHERE public_slug = ?";

  connection.query(productSql, [public_slug], (err, productResult) => {
    if (err) return res.status(500).json({ error: "Database query failed" });

    // se il prodotto non esiste restituiamo 404
    if (productResult.length === 0) {
      return res.status(404).json({ error: "Nessun profumo trovato" });
    }

    // salviamo il prodotto e il suo id
    const product = productResult[0];
    const productId = product.id;

    // query per recuperare gli id delle note del prodotto corrente
    const notesSql = `
      SELECT note_id
      FROM note_product
      WHERE product_id = ?
    `;

    connection.query(notesSql, [productId], (err, noteResults) => {
      if (err) return res.status(500).json({ error: "Database query failed" });

      // se il prodotto non ha note non possiamo trovare correlati
      if (noteResults.length === 0) {
        return res.json([]);
      }

      // ricaviamo gli id delle note
      const noteIds = noteResults.map((note) => note.note_id);

      // query per trovare prodotti che condividono il maggior numero di note
      const relatedSql = `
        SELECT products.*, COUNT(*) AS common_notes
        FROM products
        JOIN note_product ON products.id = note_product.product_id
        WHERE note_product.note_id IN (?)
          AND products.id != ?
        GROUP BY products.id
        ORDER BY common_notes DESC
      `;

      connection.query(
        relatedSql,
        [noteIds, productId],
        (err, relatedResults) => {
          if (err) {
            return res.status(500).json({ error: "Database query failed" });
          }

          // aggiungiamo il path completo dell'immagine principale
          const formattedResults = relatedResults.map((product) => {
            return {
              ...product,
              product_image_url: product.product_image_url
                ? `http://localhost:3000/img/${product.product_image_url}`
                : null,
            };
          });

          // restituiamo i prodotti correlati
          res.json(formattedResults);
        },
      );
    });
  });
}

function search(req, res) {
  // recuperiamo tutti i filtri dalla query string
  const { name, min_price, max_price, family, note_name, note_type, sortBy } =
    req.query;

  // espressione SQL per calcolare il prezzo effettivo:
  // se esiste uno sconto usiamo il prezzo scontato, altrimenti il prezzo pieno
  const effectivePriceSql = `
    CASE
      WHEN products.discount_value IS NOT NULL AND products.discount_value > 0
      THEN products.price * (1 - products.discount_value / 100)
      ELSE products.price
    END
  `;

  // query base con join sulle note per permettere i filtri combinati
  let sql = `
    SELECT DISTINCT products.*
    FROM products
    LEFT JOIN note_product ON products.id = note_product.product_id
    LEFT JOIN notes ON note_product.note_id = notes.id
    WHERE 1 = 1
  `;

  // array dei parametri da passare in sicurezza alla query
  const params = [];

  // filtro per nome profumo
  if (name && name.trim() !== "") {
    sql += " AND LOWER(products.name) LIKE ?";
    params.push(`%${name.trim().toLowerCase()}%`);
  }

  // filtro per prezzo minimo basato sul prezzo effettivo
  if (min_price && min_price !== "") {
    sql += ` AND ${effectivePriceSql} >= ?`;
    params.push(parseFloat(min_price));
  }

  // filtro per prezzo massimo basato sul prezzo effettivo
  if (max_price && max_price !== "") {
    sql += ` AND ${effectivePriceSql} <= ?`;
    params.push(parseFloat(max_price));
  }

  // filtro per famiglia olfattiva
  if (family && family.trim() !== "") {
    sql += " AND notes.family = ?";
    params.push(family.trim());
  }

  // filtro per nome essenza / nota
  if (note_name && note_name.trim() !== "") {
    sql += " AND LOWER(notes.name) LIKE ?";
    params.push(`%${note_name.trim().toLowerCase()}%`);
  }

  // filtro per tipo nota
  if (note_type && note_type.trim() !== "") {
    sql += " AND notes.note_type = ?";
    params.push(note_type.trim());
  }

  // ordinamento finale dei risultati
  if (sortBy === "name-asc") {
    sql += " ORDER BY products.name ASC";
  } else if (sortBy === "name-desc") {
    sql += " ORDER BY products.name DESC";
  } else if (sortBy === "price-asc") {
    sql += ` ORDER BY ${effectivePriceSql} ASC`;
  } else if (sortBy === "price-desc") {
    sql += ` ORDER BY ${effectivePriceSql} DESC`;
  } else if (sortBy === "size-asc") {
    sql += " ORDER BY products.size_ml ASC";
  } else if (sortBy === "size-desc") {
    sql += " ORDER BY products.size_ml DESC";
  } else {
    // ordinamento di default
    sql += " ORDER BY products.name ASC";
  }

  // eseguiamo la query di ricerca
  connection.query(sql, params, (err, results) => {
    if (err) {
      console.error("SEARCH ERROR:", err);
      return res.status(500).json({ error: "Errore durante la ricerca" });
    }

    // formattiamo i risultati aggiungendo il path completo dell'immagine principale
    const formattedResults = results.map((product) => {
      return {
        ...product,
        product_image_url: product.product_image_url
          ? `http://localhost:3000/img/${product.product_image_url}`
          : null,
      };
    });

    // restituiamo i prodotti trovati
    res.json(formattedResults);
  });
}

module.exports = { index, show, getNote, related, search };
