
var r = require('rethinkdb')
var RETHINK_HOST = process.env.RETHINK_HOST || 'rethink'

module.exports.connect = function() {
  console.log(`connecting to rethinkdb @ ${RETHINK_HOST}`)
  return r.connect({
    db: 'stats',
    host: RETHINK_HOST
  })
}

module.exports.insertFn = function(conn) {
  return function(doc) {
    var query = r.table('requests').insert(doc)
    return query.run(conn)
  }
}

