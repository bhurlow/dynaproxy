'use strict'

var koa = require('koa')
// var request = require('superagent')
var request = require('request')
var app = koa()

// var downstream = 'http://192.168.99.100:3500'

// dynamically changed
var routes = {}

function buildOpts(ctx) {
  return {
      method: 'GET'
    , uri: downstream
  }
}

function forward(ctx) {
  return new Promise(function(resolve, reject) {
    let opts = buildOpts(ctx)
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
  if (!this.host) return handleApi(this)
  if (!routes[this.host]) {
    this.body = 'no match'
  }
})

app.use(function*(next) {
  yield forward(this)
})

app.on('error', function(err) {
  console.log(err.code)
})

app.listen(3000)
