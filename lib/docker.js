
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

// // For development
// docker = new Docker({
//   host: DOCKER_IP,
//   port: DOCKER_PORT,
//   ca: fs.readFileSync(DOCKER_CERT_PATH + '/ca.pem'),
//   cert: fs.readFileSync(DOCKER_CERT_PATH + '/cert.pem'),
//   key: fs.readFileSync(DOCKER_CERT_PATH + '/key.pem')
// });
// watchDockerEvents()

var initDocker = function() {
  docker.listContainers(function(err, containers) {
    containers.map((x) => x.Id)
              .forEach(handleNewContainer)
  })
}

module.exports.watchDocker = function() {
  console.log('looking for docker instance')

   docker = new Docker({socketPath: '/var/run/docker.sock'});

	 docker.info(function (err, info) {
     if (err) {
       console.log('x cannot connect to docker')
       return
     }
     console.log('connected to docker')
     watchDockerEvents()
     initDocker()
	 });

}

// docker.getEvents(function(err, res) {
//   // console.log(err)
//   // console.log(res)
// })

function parseEnvVar(string) {
  var parts = string.split('=')
  return parts[1]
}

function handleContainerDie(id) {
  console.log('CONTAINER DIE', id)
}

function handleNewContainer(id) {
  console.log('handling container', id)
  var container = docker.getContainer(id)
  container.inspect(function(err, data) {

    var name = data.Name
    var env = data.Config.Env

    // pick the first exposed port
    // TODO handle case if there are multiple 
    var port;
    var ports = Object.keys(data.NetworkSettings.Ports)
    if (ports.length) {
      // e.g. '3000/tcp'
      port = ports[0].split('/')[0]
    }
    
    var VIRTUAL_HOST = env.filter(x => x.startsWith('VIRTUAL_HOST'))[0]

    // TODO handle containers with no names
    // should be possible by hitting the network info
    // console.log(data.NetworkSettings)

    if (VIRTUAL_HOST) {
      var VIRTUAL_HOST = parseEnvVar(VIRTUAL_HOST)
      var name = name.replace('/', '')
      if (port) name += ':' + port
      console.log(`adding mapping ${VIRTUAL_HOST} -> ${name}`)
      routes.setRoute(VIRTUAL_HOST, name)
    }

  })
}

function watchDockerEvents() {
  docker.getEvents(function(err, stream) {
    stream.on('data', function(chunk) {
      let event = JSON.parse(chunk.toString())
      let type = event.Type
      let status = event.status
      let id = event.Actor.ID
      if (!id) return console.log('no id in event')
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

