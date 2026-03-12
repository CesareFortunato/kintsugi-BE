const connection = require("../data/db");

function index(req, res) {
  //Stringa di sql
  const sql = "SELECT * FROM products";
  //Chiamata all'index con gestione di errore
  connection.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "Database query failed" });
    results = results.map((product) => {
      return {
        ...product,

        product_image_url: `http://localhost:3000/img/${product.product_image_url}`,
      };
    });

    res.json(results);
  });
}

//funzione show del singolo prodotto
function show(req, res) {
  //utilizzo del public slug nella query
  const { public_slug } = req.params;

  //Seleziono tutto dai prodotti con un determinato public slug
  const parfumesSql = "SELECT * FROM products WHERE public_slug = ?";

  connection.query(parfumesSql, [public_slug], (err, parfumeResult) => {
    if (err) return res.status(500).json({ error: "Database query failed" });
    if (parfumeResult.length === 0)
      return res.status(404).json({ error: "Profumo non trovato" });

    //ritorno l'obj e il suo id
    const parfume = parfumeResult[0];
    const parfumeId = parfume.id;

    //recupero imgs allegate tramite id
    const imagesSql = "SELECT * FROM  product_images WHERE product_id = ? ";
    connection.query(imagesSql, [parfumeId], (err, imageResult) => {
      if (err) return res.status(500).json({ error: "Database query failed" });
      //aggiungo una nuova proprietà all'oggetto parfume
      parfume.images = imageResult;

      //seleziono le colonne che appartengono alla tabella notes e faccio join con la tabella pivot
      const notesSql = `
        SELECT notes.* 
        FROM notes
        JOIN note_product ON notes.id = note_product.note_id
        WHERE note_product.product_id = ?
      `;
      connection.query(notesSql, [parfumeId], (err, notesResult) => {
        if (err)
          return res.status(500).json({ error: "Database query failed" });

        //aggungo proprietà note all'obj parfume
        parfume.notes = notesResult;
        //ritorno l'obj
        res.json(parfume);
      });
    });
  });
}

//lascio qua getnote perché appartiene sempre ai profumi
function getNote(req, res) {
  //prendo nella query il parametro id
  const { noteId } = req.params;

  //seleziona tutte le col di products da products dove è presente nota con determinato id
  const sql = `
    SELECT products.*
    FROM products
    JOIN note_product ON products.id = note_product.product_id
    WHERE note_product.note_id = ?`;

  connection.query(sql, [noteId], (err, productsResults) => {
    if (err) return res.status(500).json({ error: "Database query failed" });
    //se l'array di obj è vuoto non è stato trovato nessun profumo
    if (productsResults.length === 0) {
      return res.status(404).json({ message: "Nessun profumo trovato" });
    }
    //salvo gli id dei prodotti in un array mappando
    const productIds = productsResults.map((product) => product.id);

    //seleziono tutte le note dei profumi che hanno l'id che ho recuperato e IN funziona
    //confrontando più valori e non un singolo e in cadranno gli id dei profumi recuperati
    const notesSql = `
      SELECT notes.*, note_product.product_id 
      FROM notes
      JOIN note_product ON notes.id = note_product.note_id
      WHERE note_product.product_id IN (?)
    `;

    connection.query(notesSql, [productIds], (err, notesResults) => {
      if (err) return res.status(500).json({ error: "Nessun profumo trovato" });

      //creo un nuovo array dove mappo i prodotti precedentemente ricevuti
      const results = productsResults.map((product) => {
        //ritorno qua con lo spread gli array di objs e aggiungo la proprietà notes ai singoli obj
        return {
          ...product,
          notes: notesResults.filter((n) => n.product_id === product.id),
        };
      });

      res.json(results);
    });
  });
}

function related(req, res) {
  const { public_slug } = req.params;

  const productSql = "SELECT * FROM products WHERE public_slug = ?";

  connection.query(productSql, [public_slug], (err, productResult) => {
    if (err) return res.status(500).json({ error: "Database query failed" });
    if (productResult.length === 0) {
      return res.status(404).json({ error: "Nessun profumo trovato" });
    }

    const product = productResult[0];
    const productId = product.id;

    const notesSql = `
      SELECT note_id
      FROM note_product
      WHERE product_id = ?
    `;

    connection.query(notesSql, [productId], (err, noteResults) => {
      if (err) return res.status(500).json({ error: "Database query failed" });

      if (noteResults.length === 0) {
        return res.json([]);
      }

      const noteIds = noteResults.map((note) => note.note_id);

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
          if (err)
            return res.status(500).json({ error: "Database query failed" });

          const formattedResults = relatedResults.map((product) => {
            return {
              ...product,
              product_image_url: `http://localhost:3000/img/${product.product_image_url}`,
            };
          });

          res.json(formattedResults);
        },
      );
    });
  });
}

function search(req, res) {
  const {
    name,
    min_price,
    max_price,
    family,
    note_name,
    note_type,
    sortBy,
  } = req.query;

  let sql = `
    SELECT DISTINCT products.*
    FROM products
    LEFT JOIN note_product ON products.id = note_product.product_id
    LEFT JOIN notes ON note_product.note_id = notes.id
    WHERE 1 = 1
  `;

  const params = [];

  // filtro per nome profumo
  if (name && name.trim() !== "") {
    sql += " AND LOWER(products.name) LIKE ?";
    params.push(`%${name.trim().toLowerCase()}%`);
  }

  // filtro per prezzo minimo
  if (min_price && min_price !== "") {
    sql += " AND products.price >= ?";
    params.push(parseFloat(min_price));
  }

  // filtro per prezzo massimo
  if (max_price && max_price !== "") {
    sql += " AND products.price <= ?";
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

  // filtro per tipo nota: testa / cuore / base
  if (note_type && note_type.trim() !== "") {
    sql += " AND notes.note_type = ?";
    params.push(note_type.trim());
  }

  // ordinamento
  if (sortBy === "name-asc") {
    sql += " ORDER BY products.name ASC";
  } else if (sortBy === "name-desc") {
    sql += " ORDER BY products.name DESC";
  } else if (sortBy === "price-asc") {
    sql += " ORDER BY products.price ASC";
  } else if (sortBy === "price-desc") {
    sql += " ORDER BY products.price DESC";
  } else if (sortBy === "size-asc") {
    sql += " ORDER BY products.size_ml ASC";
  } else if (sortBy === "size-desc") {
    sql += " ORDER BY products.size_ml DESC";
  } else {
    sql += " ORDER BY products.name ASC";
  }

  connection.query(sql, params, (err, results) => {
    if (err) {
      console.error("SEARCH ERROR:", err);
      return res.status(500).json({ error: "Errore durante la ricerca" });
    }

    const formattedResults = results.map((product) => {
      return {
        ...product,
        product_image_url: product.product_image_url
          ? `http://localhost:3000/img/${product.product_image_url}`
          : null,
      };
    });

    res.json(formattedResults);
  });
}

module.exports = { index, show, getNote, related, search };
