function notFound(req, res, next) {
  res.status(404);

  res.json({
    error: "not found",
    messagge: "Pagina non trovata!",
  });
}

module.exports = notFound;
  