'use strict'

var debug = require('debug')('traffic:core')
var path = require('path')
var koa = require('koa')
var request = require('superagent')
var app = module.exports.app = koa()
var debug = require('debug')('traffic')
var router = require('koa-router')()
var fs = require('fs')
var co = require('co')
var db = require('./lib/db')
var routes = require('./lib/routes')
var docker = require('./lib/docker')
var httpProxy = require('http-proxy')
var auth = require('basic-auth')

// database conn
var conn = null
var insertFn = null

// get proxy fn but dont start server
var proxy = httpProxy.createProxyServer()

// ===== UTIL

function* entries(obj) {
  for (let key of Object.keys(obj)) {
    yield [key, obj[key]];
  }
}

// ===== API

// TODO this should cache result
function errorPage(fn) {
  try {
    return fs.readFileSync('/var/503.html')
  }
  catch (err) {
    // console.log(err)
    return fs.readFileSync('./public/503.html')
  }
}

function onProxyError(req, res) {
  return function(e) {
    debug('downstream error')
    debug(e)
    res.statusCode = 503
    var page = errorPage()
    res.end(page)
  }
}

function denyAccess(ctx) {
  ctx.status = 401
  ctx.set('WWW-Authenticate', 'Basic')
  ctx.body = 'no access'
}

function forwardRequest(ctx) {
  ctx.respond = false
  var target = ctx.state.route
  var req = ctx.req
  var res = ctx.res
  proxy.web(req, res, { target: 'http://' + target }, onProxyError(req, res))
}

// here we are using the http-proxy library to handle the
// requets forwarding since there are lots of small cases that need to be
// handled
// this could be replaced in the future with a different proxy function
// *note this is hijacking the request from koa
function forward(ctx) {

  var basicAuth = routes.auth[ctx.host]
  var user = auth(ctx)

  // if no basic auth exists for this target
  // move on
  if (!basicAuth) return forwardRequest(ctx)

  // if auth is wrong, deny
  if (!user || user.name !== basicAuth.name || user.pass !== basicAuth.pass) {
    denyAccess(ctx)
  }
  // otherwise continue
  else forwardRequest(ctx)
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
  debug(`routing host ${host} -> ${route}`)
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
  // yield forward(this)
  this.state.route = route
  forward(this)
})

app.on('error', function(err) {
  debug('ERROR IN APP')
  debug(err)
})

// ===== CTLR API
// TODO relocate this section

var api = module.exports.api = koa()

// router.get('*', function* (next) {
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
    debug(`looking in: ${CERT_PATH} for SSL certs`)
    var dir = fs.readdirSync(CERT_PATH)

    if (dir.length === 0) {
      debug('no certs found -- ignoring ssl')
      return reject(null)
    }

    if (dir.length > 2) {
      debug('found more than 2 files in certs directory -- ignoring ssl')
      return reject(null)
    }

    key = dir.filter((file) => file.endsWith('.key'))[0]
    cert = dir.filter((file) => file.endsWith('.crt'))[0]
    debug('found certs', dir)
    return resolve(true)

  })
}

function createSSLServer(handler) {
  var options = {
    key:  fs.readFileSync(path.resolve(CERT_PATH, key)),
    cert: fs.readFileSync(path.resolve(CERT_PATH, cert))
  }
  var port = 3000
  debug(`starting HTTPS server on port ${port}`)
  https.createServer(options, app.callback()).listen(port)
}


// ===== GOTIME

if (!module.parent) {
  co(function*() {
    try {
      conn = yield db.connect()
      debug('connected to db')
      insertFn = db.insertFn(conn)
    }
    catch (err) {
      debug('no connection to rethink -- skpping')
    }

    var hasCerts = yield findCerts()
    if (hasCerts) createSSLServer(app.callback())

    else {
      debug('proxy listening on 3000')
      app.listen(3000)
    }

    // watch for changes on docker host
    // if it is accessible
    // docker.initDocker()
    docker.watchDocker()

    debug('api listening on 3500')
    api.listen(3500)

  }).catch(function(err) {
    console.log(err)
  })
}



