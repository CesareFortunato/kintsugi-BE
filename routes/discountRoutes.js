const express = require("express");
const router = express.Router();

const discountControllers = require("../controllers/discountControllers");

router.get("/", discountControllers.index);

module.exports = router;
