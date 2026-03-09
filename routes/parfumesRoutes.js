const express = require("express");
const router = express.Router();

const parfumesControllers = require("../controllers/parfumesControllers");

router.get("/", parfumesControllers.index);

module.exports = router;
