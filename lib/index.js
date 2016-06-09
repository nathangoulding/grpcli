'use strict';

var opts,
    grpc = require('grpc'),
    stdrepl = require('stdrepl'),
    prompt = require('prompt'),
    bnf = require('bnf'),
    compiler = new bnf.Compiler,
    wait = require('wait.for'),
    parser, cmd;

compiler.CompileScript("./lib/grpcli.bnf", "grpcli", function(interpreter) {
  parser = compiler.CreateParser(interpreter, {
    "section": function(token) {
      repl.applySection(token.text);
    },
    "action": function(token) {
      repl.applyAction(token.text);
    },
    "extra": function(token) {
      if (!repl.executed) {
        repl.applyExtra(token.text);
      }
    }
  });
});

var replCommand = function() {

  var _section;

  var _action;

  var _extra;

  var _command;

  var _calledCallback = false;

  var _externalCallback = function() {};

  var _callback = function() {
    if (_calledCallback) {
      return;
    }
    _calledCallback = true;
    _externalCallback();
  };

  var _extraApplied = false;

  this.createNewCommand = function(command, callback) {
    _command = command;
    _section = '';
    _action = '';
    _extra = '';
    _externalCallback = callback;
    _extraApplied = false;
    _calledCallback = false;
    return this;
  };

  var _executeCommand = function() {
    switch (_section) {
      case 'rpc':
        switch(_action) {
          case 'list':
            printUsage();
            _callback();
            break;
          case 'call':
            var method;
            var parameters;
            if (_extra.indexOf(' ') > 0) {
              method = _extra.substr(0, _extra.indexOf(' '));
              try {
                parameters = JSON.parse(_extra.substr(_extra.indexOf(' ')).trim());
              } catch (e) {
                console.log('Error: '.red + 'Unable to parse JSON: ' + e);
                _callback();
                return;
              }
            } else {
              method = _extra;
              parameters = {};
            }
            if (typeof(module.opts.client[method]) !== 'function') {
              console.log('Error: '.red + 'Invalid method ' + method.blue.bold + ' specified');
              _callback();
              return;
            } else {
              console.log('Info: '.green + 'Calling ' + method.blue.bold + ' on ' + module.opts.serviceName.yellow);
              try {
                module.opts.client[method](parameters, function(err, response) {
                  if (err) {
                    console.log('Error: '.red);
                    console.log(JSON.stringify(err));
                    _callback();
                    return;
                  }
                  console.log('Response:'.green);
                  console.log(JSON.stringify(response, null, 2));
                  _callback();
                });
              } catch (e) {
                console.log('Error: '.red + 'Unable to call ' + method.blue.bold);
                console.log(e);
                _callback();
              }
            }
            break;
          default:
            console.log('Error: '.red + 'Invalid command supplied');
            _callback();
        }
        break;
      default:
            console.log('Error: '.red + 'Invalid command supplied');
            _callback();
    }
  };

  this.applySection = function(section) {
    _section = section;
  };

  this.applyAction = function(action) {
    _action = action;
  };

  this.applyExtra = function(extra) {
    if (_extraApplied) {
      return;
    }
    _extraApplied = true;
    _extra = extra.trim();
  };

  this.execute = function() {
    try {
      var result = parser.ParseScriptString(_command);
      if (!result.rootToken.validated) {
        _callback();
      } else {
        _executeCommand();
      }
    } catch (e) {
      console.log('Error: '.red + e);
      _callback();
    }
  };
};

var repl = new replCommand();

function init(opts) {
  module.opts = opts;
  identifyPackage(opts, function(opts) {
    module.opts = opts;
    identifyService(opts, function(opts) {
      module.opts = opts;
      createRepl(opts);
    })
  });
}

function identifyPackage(opts, callback) {
  var proto = grpc.load(opts.proto_file);

  opts.proto = proto;

  var packages = Object.keys(proto);

  if (packages.length == 0) {
    console.errog('Error: '.red + 'No protobuf package found in .proto file: ' + opts.proto.file);
  } else if (packages.length == 1) {
    opts.package = packages[0];
    callback(opts);
  } else {
    prompt.start();
    prompt.message = '';
    prompt.get({
      properties: {
        package: {
          type: 'string',
          pattern: new RegExp('^(' + packages.join('|') + ')$'),
          description: 'Select which package to use (' + packages.join('|') + '): ',
          message: 'Package must be one of: ' + packages.join(', ') + '',
          required: true
        }
      }
    }, function (err, result) {
      if (err) {
        throw new Error('Must select a package to continue');
      }
      prompt.stop();
      opts.package = result.package;
      callback(opts);
    });
  }
}

function identifyService(opts, callback) {
  console.log('Package: '.green + '%s', opts.package.yellow);

  var def = opts.proto[opts.package];

  opts.def = def;

  if (opts.serviceName) {
    if (typeof(def[opts.serviceName]) !== 'function') {
      throw new Error('Error: '.red + opts.serviceName + ' does not exist in this .proto file');
    }
    opts.service = def[opts.serviceName];
    callback(opts);
  } else {
    var services = [];
    Object.keys(def).forEach(function (property) {
      if (def[property].service) {
        services.push(def[property].service.name);
      }
    });
    if (services.length == 1) {
      opts.serviceName = services[0];
      opts.service = def[services[0]];
      callback(opts);
    } else {
      prompt.start();
      prompt.message = '';
      prompt.get({
        properties: {
          service: {
            type: 'string',
            pattern: new RegExp('^(' + services.join('|') + ')$'),
            description: 'Select which service to use (' + services.join('|') + '): ',
            message: 'Service must be one of: ' + services.join(', ') + '',
            required: true
          }
        }
      }, function (err, result) {
        if (err) {
          throw new Error('Must select a service to continue');
        }
        prompt.stop();
        opts.serviceName = result.service;
        opts.service = def[result.service];
        callback(opts);
      });
    }
  }
}

function createRepl(opts) {

  console.log('Service: '.green + '%s', opts.serviceName.yellow);

  var creds = opts.insecure ? grpc.credentials.createInsecure() : grpc.credentials.createSsl();

  var user = opts.insecure ? 'insecure' : 'ssl';

  opts.client = new opts.service(opts.host + ':' + opts.port, creds);

  console.log('Host: '.green + '%s', opts.host.yellow);
  console.log('Port: '.green + '%s', opts.port.yellow);
  console.log('Secure: '.green + '%s', opts.insecure ? 'No'.red : 'Yes'.yellow);

  stdrepl.tabsize = 1;
  stdrepl.prompt = '[' + user + '@' + opts.host + ':' + opts.port + ']#';

  stdrepl.eval = function(command, callback) {
    if (command && command.length > 0) {
      repl.createNewCommand(command, callback).execute();
    } else {
      callback();
    }
  };
}

function printUsage() {
  module.opts.service.service.children.forEach(function(child) {
    console.log('%s(%s) {\n  return %s;\n}', (child.name.charAt(0).toLowerCase() + child.name.slice(1)).blue.bold, child.requestName, child.responseName);
  });
}

if (!String.prototype.repeat) {
  String.prototype.repeat = function(count) {
    'use strict';
    if (this == null) {
      throw new TypeError('can\'t convert ' + this + ' to object');
    }
    var str = '' + this;
    count = +count;
    if (count != count) {
      count = 0;
    }
    if (count < 0) {
      throw new RangeError('repeat count must be non-negative');
    }
    if (count == Infinity) {
      throw new RangeError('repeat count must be less than infinity');
    }
    count = Math.floor(count);
    if (str.length == 0 || count == 0) {
      return '';
    }
    // Ensuring count is a 31-bit integer allows us to heavily optimize the
    // main part. But anyway, most current (August 2014) browsers can't handle
    // strings 1 << 28 chars or longer, so:
    if (str.length * count >= 1 << 28) {
      throw new RangeError('repeat count must not overflow maximum string size');
    }
    var rpt = '';
    for (;;) {
      if ((count & 1) == 1) {
        rpt += str;
      }
      count >>>= 1;
      if (count == 0) {
        break;
      }
      str += str;
    }
    // Could we try:
    // return Array(count + 1).join(this);
    return rpt;
  }
}

module.exports = {
  init: init
};