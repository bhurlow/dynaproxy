
// ===== ROUTE STORE
// currently an object, could be persisted somewhere
// todo relocate this section

var _routes = {}

module.exports.getRoute = function getRoute(hostname) {
  return _routes[hostname]
}

module.exports.setRoute = function setRoute(hostname, downstream) {
  return _routes[hostname] = downstream
}

module.exports.deleteRoute = function deleteRoute(hostname) {
  delete _routes[hostname]
}

module.exports.flushRoutes = function flushRoutes() {
  _routes = {}
}

