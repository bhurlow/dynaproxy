
// ===== ROUTE STORE
// currently an object, could be persisted somewhere
// todo relocate this section

var debug = require('debug')('traffic:routes')
var _routes = {}

function routeChangeTrigger() {
  debug('is now >>', _routes)
}

module.exports.getRoute = function getRoute(hostname) {
  return _routes[hostname]
}

module.exports.setRoute = function setRoute(hostname, downstream) {
  _routes[hostname] = downstream
  routeChangeTrigger()
  return 
}

module.exports.deleteRoute = function deleteRoute(hostname) {
  delete _routes[hostname]
  routeChangeTrigger()
  return 
}

module.exports.flushRoutes = function flushRoutes() {
  _routes = {}
  routeChangeTrigger()
  return 
}

module.exports.getAll = function getAll() {
  routeChangeTrigger()
  return _routes
}

// object for setting if basic auth is required
module.exports.auth = {}

