
var test = require('clearer')
var rp = require('request-promise')
var app = require('./').app
var http = require('http')

// ===== TESTING UTIL =====

// var downstream = 'http://192.168.99.100:3500'

function p(fn) {
  return new Promise(function(resolve, reject) {
    fn(resolve, reject)
  })
}

var server = http.createServer(app.callback())

function startServer() {
  return new Promise(function(resolve, reject) {
    server.listen(3000, function() {
      return resolve(this)
    })
  })
}

function stopServer() {
  return new Promise(function(resolve, reject) {
    server.close(function() {
      return resolve(this)
    })
  })
}

function req(path, host) {
  var opts = {
    url: 'http://localhost:3000' + path,
    headers: {
      'Host' : host
    }
  }
  return rp(opts)
}

test('basic tests', function*() {
  console.log('starting server')
  var server = yield startServer()
  
  var res = yield rp('http://localhost:3000')
  console.log('res', res)
  // console.log('before promise')
  // var res = yield thingy()
  // console.log('promise result', res)
  this.equals(1, 2)
  console.log('closing server')
  var res2 = yield stopServer()
})



