const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT;
const notFound = require("./middlewares/notFound");
const errorsHandler = require("./middlewares/errorsHandler");
//importo i routes
const parfumesRoutes = require("./routes/parfumesRoutes");
const ordersRoutes = require("./routes/ordersRoutes");

app.use("/parfumes", parfumesRoutes);

//middlewares
app.use(express.static("public"));
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.send("ciaone");
});

app.use("/parfumes", parfumesRoutes);
app.use("/orders", ordersRoutes);

app.use(errorsHandler);
app.use(notFound);
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
