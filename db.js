
var RETHINK_HOST = '192.168.99.100'
var r = require('rethinkdb')

var conn = null

module.exports.connect = function() {
  return r.connect({
    db: 'stats',
    host: RETHINK_HOST
  })
}

module.exports.insertFn = function(conn) {
  return function(doc) {
    console.log('doingi insert')
    var query = r.table('requests').insert(doc)
    return query.run(conn)
  }
}

