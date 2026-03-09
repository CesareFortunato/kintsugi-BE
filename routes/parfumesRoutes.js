const express = require("express");
const router = express.Router();

const parfumesControllers = require("../controllers/parfumesControllers");

router.get("/", parfumesControllers.index);

router.get("/:public_slug", parfumesControllers.show);

module.exports = router;
