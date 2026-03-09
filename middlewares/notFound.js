function notFound(req, res, next) {
  res.status(404);

  res.json({
    error: "not found",
<<<<<<< HEAD
    messagge: "Pagina non trovata",
=======
    messagge: "Pagina non trovata!",
>>>>>>> 939c2aba2750e243a8eb848c107c23d69c0b358c
  });
}

module.exports = notFound;
