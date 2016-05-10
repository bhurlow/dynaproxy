
var test = require('clearer')
var co = require('co')
var rp = require('request-promise')
var request = require('superagent')
var app = require('./').app
var api = require('./').api
var http = require('http')

// ==== REQUIREMENTS
// ensure these tests are even runnable 
// *expects a downstream app at http://192.168.99.100:3500

var downstream = 'http://192.168.99.100:3500'
var DOWNSTREAM_HOST = '192.168.99.100:3500'
var PROXY_PORT = 3000
var API_PORT = 3500

co(function* () {
  var res = yield rp(downstream)
}).catch(function(err) {
  if (err.error.code == 'ECONNREFUSED') {
    console.log(`downstream @ ${downstream} not available`)
    process.exit()
  }
})

// ===== TESTING UTIL =====

var proxyServer = http.createServer(app.callback())
var apiServer = http.createServer(api.callback())

function startServer(server, port) {
  return new Promise(function(resolve, reject) {
    server.listen(port, function() {
      return resolve(this)
    })
  })
}

function stopServer(server) {
  return new Promise(function(resolve, reject) {
    server.close(function() {
      return resolve(this)
    })
  })
}

function makeReq(method, port, path, host) {
  // var opts = {
  //   url: 'http://localhost:3000' + path,
  //   headers: {
  //     'Host' : host
  //   }
  // }
  return new Promise(function(resolve, reject) {
    var url = 'http://localhost:' + port + path
    var req = request(method, url)
    req.set('Host', host)
    req.end(function(err, res) {
      // console.log(err)
      if (err) return reject(err);
      return resolve(res)
    })
  })
}

test('adding a route', function*() {

  yield startServer(proxyServer, PROXY_PORT)
  yield startServer(apiServer, API_PORT)

  // proxy should fail with no registered routes
  var res;
  try {
    res = yield makeReq('GET', PROXY_PORT, '/', 'example.com')
  }
  catch (err) {
    this.equals(err.status, 400)
  }

  // add a route on the api
  res = ''
  try {
    var url = `/add/example.com/${DOWNSTREAM_HOST}`
    res = yield makeReq('POST', API_PORT, url, 'foo')
    this.equals(res.status, 200)
  }
  catch (err) {

  }

  // then see if it passes through
  var res = ''
  try {
    res = yield makeReq('GET', PROXY_PORT, '/', 'example.com')
    this.equals(200, res.status)
  }
  catch (err) {
    console.log(err.message)
  }

  yield stopServer(proxyServer)
  yield stopServer(apiServer)
})


