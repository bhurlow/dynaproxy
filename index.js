'use strict'

var koa = require('koa')
// var request = require('request')
var request = require('superagent')
var app = module.exports.app = koa()
var debug = require('debug')('traffic')
var router = require('koa-router')()

// ===== ROUTE STORE
// currently an object, could be persisted somewhere

var _routes = {}

function getRoute(hostname) {
  return _routes[hostname]
}

function setRoute(hostname, downstream) {
  return _routes[hostname] = downstream
}

function deleteRoute(hostname) {
  delete _routes[hostname]
}

function flushRoutes() {
  _routes = {}
}

// ===== API

function forward(ctx) {
  var method = ctx.method
  var route = getRoute(ctx.host)
  return new Promise(function(resolve, reject) {
    request(method, route)
      .end(function(err, res) {
        if (err) return reject(err);
        // what more should we set?
        ctx.body = res.text
        ctx.status = res.status
        return resolve(true)
      })
  })
}

function handleApi(ctx) {
  ctx.body = 'no api method'
}

app.use(function*(next) {
  var host = this.host
  var route = getRoute(host)
  if (!this.host) {
    this.status = 400
    this.body = 'must request with hostname'
    return
  }
  if (!getRoute(this.host)) {
    this.status = 400
    this.body = 'no matching host'
    return
  }
  yield forward(this)
})

app.on('error', function(err) {
  console.log(err.code)
})

// ===== CTLR API

var api = module.exports.api = koa()

router.get('*', function* (next) {
  this.status = 400
})

router.post('/add/:host/:downstream', function* (next) {
  setRoute(this.params.host, this.params.downstream)
  this.status = 200
  this.body = 'route set'
})

router.post('/del/:host', function* (next) {
  deleteRoute(this.params.host)
  this.status = 200
  this.body = 'route deleted'
})

router.post('/flush', function* (next) {
  flushRoutes()
  this.set('Content-Type', 'application/json')
  this.body = JSON.stringify(_routes)
})

router.post('/info', function* (next) {
  this.set('Content-Type', 'application/json')
  this.body = JSON.stringify(_routes)
})

api.use(router.routes())

// ===== GOTIME

if (!module.parent) {
  console.log('proxy listening on 3000')
  app.listen(3000)
  console.log('api listening on 3500')
  api.listen(3500)
}



