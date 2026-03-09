function errorsHandler(err, req, res, next) {
  res.status(500);

  res.json({
    error: err.message,
    message: "Errore dal server",
  });
}

module.exports = errorsHandler;
