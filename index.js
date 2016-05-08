'use strict'

var koa = require('koa')
var request = require('superagent')
var app = module.exports.app = koa()
var debug = require('debug')('traffic')
var router = require('koa-router')()
var fs = require('fs')
var co = require('co')
var db = require('./db')

// database conn
var conn = null
var insertFn = null

// ===== ROUTE STORE
// currently an object, could be persisted somewhere
// todo relocate this section

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

function serviceUnavailable(ctx, resolve, reject) {
  ctx.status = 503
  ctx.body = fs.readFileSync('./public/503.html')
  resolve()
}

function forward(ctx) {
  var method = ctx.method
  var route = getRoute(ctx.host)
  return new Promise(function(resolve, reject) {
    request(method, route)
      .end(function(err, res) {

        if (err) {
          console.log(err)
          return serviceUnavailable(ctx, resolve, reject)
        }

        // what more should we set?
        // should set headers on req AND res 
        ctx.body = res.text
        ctx.status = res.status
        return resolve(true)
      })
  })
}

// store requests in db
app.use(function* (next) {
  var start = new Date
  yield next
  var ms = new Date - start;
  this.set('X-Response-Time', ms + 'ms');
  // not totally clear here about when this is being executed
  // it *should* not block the request from going
  if (conn) {
    yield insertFn({
      ip: this.ip,
      headers: this.headers,
      url: this.url,
      method: this.method,
      time: ms
    })
  }
})

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
  console.log('ERROR IN APP')
  console.log(err)
})

// ===== CTLR API
// TODO relocate this section

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
  co(function*() {
    try {
      conn = yield db.connect()
      console.log('connected to db')
      insertFn = db.insertFn(conn)
    }
    catch (err) {
      console.log('no connection to rethink -- skpping')
    }
    console.log('proxy listening on 3000')
    app.listen(3000)
    console.log('api listening on 3500')
    api.listen(3500)
  }).catch(function(err) {
    console.log(err.name)
  })
}



