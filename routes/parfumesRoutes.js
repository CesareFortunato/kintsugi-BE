const express = require("express");
const router = express.Router();

const parfumesControllers = require("../controllers/parfumesControllers");

router.get("/", parfumesControllers.index);
//utilizzo il public slug invece dell'id perché messo nel db
router.get("/:public_slug", parfumesControllers.show);
//e metto le note sempre nella rotta delle profuziomazioni sperando sia coerente comunque
router.get("/note/:noteId", parfumesControllers.getNote);
//rotta per correlati
router.get("/parfumes/:public_slug/related", parfumesControllers.related);

module.exports = router;
