const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT;

app.get("/", (req, res) => {
  res.send("ciaone");
});

app.use(express.static("public"));
app.use(cors({ origin: "http://localhost:5174" }));
app.use(express.json());
app.use(express.static("public"));
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
