
var debug = require('debug')('traffic:docker')
var Docker = require('dockerode')
var url = require('url')
var fs = require('fs')
var routes = require('./routes')

var docker;
var DOCKER_HOST;
var DOCKER_CERT_PATH;
var DOCKER_PORT;
var DOCKER_IP;

var DOCKER_HOST = process.env.DOCKER_HOST
var DOCKER_CERT_PATH = process.env.DOCKER_CERT_PATH

if (DOCKER_HOST) {
  DOCKER_PORT = url.parse(DOCKER_HOST).port
  DOCKER_IP = url.parse(DOCKER_HOST).hostname
}

// For development
// watchDockerEvents()

var initDocker = function() {
  docker.listContainers(function(err, containers) {
    containers.map((x) => x.Id).forEach(handleNewContainer)
  })
}

function createDockerSocket(fn) {
  debug('looking for docker instance at /var/run/docker.sock')
  docker = new Docker({socketPath: '/var/run/docker.sock'});
  docker.info(function (err, info) {
    if (err) {
      return fn(err)
    }
    else return fn(null)
  });
}

function createDockerHttp(fn) {
  if (!DOCKER_HOST) {
    return fn(new Error('no docker settings'))
  }
  docker = new Docker({
    host: DOCKER_IP,
    port: DOCKER_PORT,
    ca: fs.readFileSync(DOCKER_CERT_PATH + '/ca.pem'),
    cert: fs.readFileSync(DOCKER_CERT_PATH + '/cert.pem'),
    key: fs.readFileSync(DOCKER_CERT_PATH + '/key.pem')
  });
  docker.info(function (err, info) {
    if (err) return fn(err)
    else {
      debug(`connected to docker: ${DOCKER_HOST}`)
      return fn()
    }
  });
}

function watchDocker() {
  debug('connected to docker!')
  watchDockerEvents()
  initDocker()
}

module.exports.watchDocker = function() {
  createDockerSocket(function(err) {
    if (!err) watchDocker()
    else {
      debug('no docker connection through socket')
      createDockerHttp(function(err) {
        if (err) return debug('no docker connection -- skipping')
        else watchDocker()
      })
    }
  })
}

function handleContainerDie(id) {
  debug('CONTAINER DIE', id)
}

function getPort(container) {
  // pick the first exposed port
  // TODO handle case if there are multiple 
  var ports = Object.keys(container.NetworkSettings.Ports)
  if (ports.length) {
    // e.g. '3000/tcp'
    return port = ports[0].split('/')[0]
  }
}

function getEnv(container) {
  var env = {}
  container.Config.Env.forEach(function(v) {
    var parts = v.split('=')
    env[parts[0]] = parts[1]
  })
  return env
}

// e.b BASIC_AUTH=foo:bar
function parseAuth(auth) {
  var parts = auth.split(':')
  var map = {}
  map.name = parts[0]
  map.pass = parts[1]
  return map
}

function handleNewContainer(id) {
  debug('handling container', id)
  var container = docker.getContainer(id)
  container.inspect(function(err, data) {

    var name = data.Name.replace('/', '')
    debug('found container: %s', name)

    var env = getEnv(data)
    var port = getPort(data)

    // TODO handle containers with no names
    // should be possible by hitting the network info
    // debug(data.NetworkSettings)
    if (env.BASIC_AUTH && env.VIRTUAL_HOST) {
      routes.auth[env.VIRTUAL_HOST] = parseAuth(env.BASIC_AUTH)
      debug('found basic auth %s for %s', env.BASIC_AUTH, name)
    }

    if (env.VIRTUAL_HOST) {
      if (port) name += ':' + port
      debug(`adding mapping ${env.VIRTUAL_HOST} -> ${name}`)
      routes.setRoute(env.VIRTUAL_HOST, name)
    }

  })
}

function watchDockerEvents() {
  debug('listening for container events')
  docker.getEvents(function(err, stream) {
    stream.on('data', function(chunk) {
      let event = JSON.parse(chunk.toString())
      let type = event.Type
      let status = event.status
      let id = event.Actor.ID
      if (!id) return debug('no id in event')
      switch (status) {
        case 'die':
          handleContainerDie(id)
          break;
        case 'start':
          handleNewContainer(id)
          break;
      }
    })
  })
}

