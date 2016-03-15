'use strict'

var http = require('http')
var httpProxy = require('http-proxy')
var proxy = httpProxy.createProxyServer({});

var routes = {}

function listRoutes(req, res) {
  return res.end(JSON.stringify(routes))
}

function addRoute(req, res) {
  let parts = req.url.split('/').filter((x) => x !== '')
  if (parts.length !== 2) {
    res.status = 400
    return res.end('bad request')
  }
  let host = parts[0]
  let endpoint = parts[1]
  console.log(`added route ${host} -> ${endpoint}`)
  routes[host] = endpoint
  res.end('ok')
}

// tbd
function deleteRoutes(req, res) {

}

// control server 

var ctrl = http.createServer(function(req, res) {
  let url = req.url
  switch(url) {
    case "/":
      listRoutes(req, res)
      break;
    default:
      addRoute(req, res)
  }
})

ctrl.listen(3500)

// proxy server

// save in db
function indexEvent(e) {

}

function logEvent(e) {
  let s = `${e.method} -> ${e.url} ${e.address} ${e.headers.host}`
  console.log(s)
}

function extractEvent(req) {
  let e = {
      method: req.method
    , headers: req.headers
    , url: req.url
    , address: req.connection.remoteAddress
  }
  return e
}

// TODO, marke res time here
var server = http.createServer(function(req, res) {
  let e = extractEvent(req)
  logEvent(e)
  indexEvent(e)

  let host = e.headers.host
  let endpoint = routes[host]

  console.log(`routing ${host} to ${endpoint}`)

  if (!endpoint) {
    res.status = 500
    res.end('no route \n')
    return
  }

  // TODO specify http or https in api
  let proxyopt = {
    target: 'http://' + endpoint
  }

  proxy.web(req, res, proxyopt, function(e) {
    if (e) {
      console.log(e)
      res.status = 500
      res.end('proxy error')
    }
  });

})

console.log("listening")
server.listen(3000)
