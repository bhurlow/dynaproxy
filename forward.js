
var request = require('superagent')

request.get('brianhurlow.com')
  .end(function(err, res) {
    console.log(err)
    console.log(res)
  })

