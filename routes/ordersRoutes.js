const express = require("express");
const router = express.Router();

const ordersControllers = require("../controllers/ordersControllers");

router.post("/", ordersControllers.store);

router.get("/:id", ordersControllers.show);
module.exports = router;
