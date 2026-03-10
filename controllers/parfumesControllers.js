const connection = require("../data/db");

function index(req, res) {
  //Stringa di sql
  const sql = "SELECT * FROM products";
  //Chiamata all'index con gestione di errore
  connection.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "Database query failed" });
    res.json(results);
  });
}

function show(req, res) {
  const { public_slug } = req.params;

  //console.log("1. Cerco lo slug:", public_slug);
  const parfumesSql = "SELECT * FROM products WHERE public_slug = ?";

  connection.query(parfumesSql, [public_slug], (err, parfumeResult) => {
    if (err) return res.status(500).json({ error: "Database query failed" });
    if (parfumeResult.length === 0)
      return res.status(404).json({ error: "Profumo non trovato" });

    const parfume = parfumeResult[0];
    const parfumeId = parfume.id;

    //console.log("4. ID trovato:", parfumeId);

    const imagesSql = "SELECT * FROM  product_images WHERE product_id = ? ";
    connection.query(imagesSql, [parfumeId], (err, imageResult) => {
      if (err) return res.status(500).json({ error: "Database query failed" });
      parfume.images = imageResult;

      const notesSql = `
        SELECT notes.* 
        FROM notes
        JOIN note_product ON notes.id = note_product.note_id
        WHERE note_product.product_id = ?
      `;
      connection.query(notesSql, [parfumeId], (err, notesResult) => {
        if (err)
          return res.status(500).json({ error: "Database query failed" });
        parfume.notes = notesResult;

        res.json(parfume);
      });
    });
  });
}

function getNote(req, res) {
  const { noteId } = req.params;

  const sql = `
    SELECT products.*
    FROM products
    JOIN note_product ON products.id = note_product.product_id
    WHERE note_product.note_id = ?`;

  connection.query(sql, [noteId], (err, productsResults) => {
    if (err) return res.status(500).json({ error: "Database query failed" });

    if (productsResults.length === 0) {
      return res.status(404).json({ message: "Nessun profumo trovato" });
    }

    const productIds = productsResults.map((product) => product.id);

    const notesSql = `
      SELECT notes.*, note_product.product_id 
      FROM notes
      JOIN note_product ON notes.id = note_product.note_id
      WHERE note_product.product_id IN (?)
    `;

    connection.query(notesSql, [productIds], (err, notesResults) => {
      if (err) return res.status(500).json({ error: "Nessun profumo trovato" });

      const results = productsResults.map((product) => {
        return {
          ...product,
          notes: notesResults.filter((n) => n.product_id === product.id),
        };
      });

      res.json(results);
    });
  });
}

module.exports = { index, show, getNote };
