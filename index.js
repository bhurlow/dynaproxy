'use strict'

var koa = require('koa')
var request = require('request')
var app = module.exports.app = koa()
var debug = require('debug')('traffic')

// ===== ROUTE STORE
// currently an object, could be persisted somewhere

var _routes = {}

function getRoute(hostname) {
  debug('getting route', hostname)
  return _routes[hostname]
}

function setRoute(hostname, downstream) {
  debug('setting route', hostname, downstream)
  _routes[hostname] = downstream
}

// ===== API

function makeReqOpts(ctx) {
  return {
      method: 'GET'
    , uri: downstream
  }
}

function forward(ctx) {
  return new Promise(function(resolve, reject) {
    let opts = makeReqOpts(ctx)
    request(opts, function(err, res, body) {
      if (err) return reject(err)
      // console.log(res)
      ctx.body = body
      resolve()
    })
  })
}

function handleApi(ctx) {
  ctx.body = 'no api method'
}

app.use(function*(next) {
  if (!this.host) {
    this.status = 400
    this.body = 'must request with hostname'
    return
  }
  if (!getRoute(this.host)) {
    this.body = 'no matching host'
  }
})

app.use(function*(next) {
  yield forward(this)
})

app.on('error', function(err) {
  console.log(err.code)
})

// ===== CTLR API

// add a host mapping to the proxy
function add(hostname, downstream) {

}

// remove a mapping
function del() {

}

// show all mappings
function list() {

}

// delete all 
function flush() {

}

var api = module.exports.api = koa()

// ===== GOTIME

if (!module.parent) {
  console.log('proxy listening on 3000')
  app.listen(3000)
  console.log('api listening on 3500')
  api.listen(3500)
}



