const connection = require("../data/db");

function index(req, res) {
  const sql = "SELECT * FROM products WHERE discount_value IS NOT NULL";

  connection.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: "Database query failed" });
    res.json(results);
  });
}

module.exports = { index };
