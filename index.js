'use strict'

var path = require('path')
var koa = require('koa')
var request = require('superagent')
var app = module.exports.app = koa()
var debug = require('debug')('traffic')
var router = require('koa-router')()
var fs = require('fs')
var co = require('co')
var db = require('./db')
var routes = require('./lib/routes')
var docker = require('./lib/docker')

// database conn
var conn = null
var insertFn = null

// ===== UTIL

function* entries(obj) {
  for (let key of Object.keys(obj)) {
    yield [key, obj[key]];
  }
}

// ===== API

function serviceUnavailable(ctx, resolve, reject) {
  ctx.status = 503
  ctx.body = fs.readFileSync('./public/503.html')
  resolve()
}

function forward(ctx) {
  var method = ctx.method
  var route = routes.getRoute(ctx.host)
  var url = route + ctx.url
  url = 'http://' + url
  console.log(url)
  return new Promise(function(resolve, reject) {

    var req = request(method, url)

    // TODO!
    // set upstream headers
    // for (let [key, value] of entries(ctx.headers)) {
    //   req.set(key, value)
    // }
    // console.log(req)

    req.end(function(err, res) {

        if (err) {
          console.log('FORWARD REQUEST ERR')
          console.log(err)
          return serviceUnavailable(ctx, resolve, reject)
        }

        // setting headers for return 
        // what more should we set?
        // should set headers on req AND res 
        // console.log('WOULD SET', res.headers)
        for (let [key, value] of entries(res.headers)) {
          ctx.set(key, value)
        }

        // TODO how to handle gzip?
        ctx.set('content-encoding', '')

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
  var route = routes.getRoute(host)
  console.log(`routing host ${host} -> ${route}`)
  if (!this.host) {
    this.status = 400
    this.body = 'must request with hostname'
    return
  }
  if (!routes.getRoute(this.host)) {
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

// router.get('*', function* (next) {
  // console.log('yo')
  // this.status = 400
// })

router.post('/add/:host/:downstream', function* (next) {
  routes.setRoute(this.params.host, this.params.downstream)
  this.status = 200
  this.body = 'route set'
})

router.post('/del/:host', function* (next) {
  routes.deleteRoute(this.params.host)
  this.status = 200
  this.body = 'route deleted'
})

router.post('/flush', function* (next) {
  flushRoutes()
  this.set('Content-Type', 'application/json')
  this.body = JSON.stringify(_routes)
})

router.post('/info', function* (next) {
  console.log("INF")
  this.set('Content-Type', 'application/json')
  this.body = JSON.stringify(routes.getAll())
})

api.use(router.routes())

// ===== OPT-IN SSL

var CERT_PATH = process.cwd() + '/certs'
var https = require('https')

var key;
var cert;

function findCerts() {
  return new Promise(function(resolve, reject) {
    console.log(`looking in: ${CERT_PATH} for SSL certs`)
    var dir = fs.readdirSync(CERT_PATH)

    if (dir.length === 0) {
      console.log('no certs found -- ignoring ssl')
      return reject(null)
    }

    if (dir.length > 2) {
      console.log('found more than 2 files in certs directory -- ignoring ssl')
      return reject(null)
    }

    key = dir.filter((file) => file.endsWith('.key'))[0]
    cert = dir.filter((file) => file.endsWith('.crt'))[0]
    console.log('found certs', dir)
    return resolve(true)

  })
}

function createSSLServer(handler) {
  var options = {
    key:  fs.readFileSync(path.resolve(CERT_PATH, key)),
    cert: fs.readFileSync(path.resolve(CERT_PATH, cert))
  }
  console.log('starting HTTPS server on port 3000')
  https.createServer(options, app.callback()).listen(3000)
}


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

    var hasCerts = yield findCerts()
    if (hasCerts) createSSLServer(app.callback())

    else {
      console.log('proxy listening on 3000')
      app.listen(3000)
    }

    // watch for changes on docker host
    // if it is accessible
    // docker.initDocker()
    docker.watchDocker()

    console.log('api listening on 3500')
    api.listen(3500)

  }).catch(function(err) {
    console.log(err)
  })
}



