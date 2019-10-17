'use strict';

var grpc = require('grpc'),
	prompt = require('prompt'),
	repl = require(__dirname + '/repl.js');

var grpcLoad = function(filename, format, options) {
	const ProtoBuf = require('protobufjs');

	var builder = ProtoBuf.loadProtoFile(filename);

	if (!builder) {
		throw new Error('Could not load file "' + filename + '"');
	}

	return grpc.loadObject(builder.ns, {});
}

var grpcli = function () {

	var _opts = {};

	var _identifyPackage = function (callback) {

		var proto = grpcLoad(_opts.proto_file);
		_opts.proto = proto;

		var packages = Object.keys(proto);

		if (packages.length == 0) {
			console.error('Error: '.red + 'No protobuf package found in .proto file: ' + _opts.proto.file);
		} else if (packages.length == 1) {
			_opts.package = packages[0];
			callback();
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
				_opts.package = result.package;
				callback();
			});
		}
	};

	var _identifyService = function (callback) {
		console.log('Package: '.green + '%s', _opts.package.yellow);

		var def = _opts.proto[_opts.package];

		_opts.def = def;

		if (_opts.serviceName) {
			if (typeof def[_opts.serviceName] !== 'function') {
				throw new Error('Error: Service '.red + _opts.serviceName + ' does not exist in this .proto file');
			}
			_opts.service = def[_opts.serviceName];
			callback();
			return;
		}

		var services = [];
		Object.keys(def).forEach(function (property) {
			if (def[property].service) {
				services.push(property);
			}
		});
		if (services.length == 1) {
			if (typeof _opts.serviceName !== "undefined" && _opts.serviceName !== services[0]) {
				throw new Error('Error: Service '.red + _opts.serviceName + ' does not exist in this .proto file');
			}
			_opts.serviceName = services[0];
			_opts.service = def[services[0]];
			callback();
			return;
		}
		prompt.start();
		prompt.message = '';
		prompt.get({
			properties: {
				serviceName: {
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
			_opts.serviceName = result.serviceName;
			_opts.service = def[result.serviceName];
			callback();
		});
	};

	var _createRepl = function () {

		var creds = _opts.insecure ? grpc.credentials.createInsecure() : grpc.credentials.createSsl();

		var connection = _opts.insecure ? 'grpc+insecure' : 'grpc+ssl';

		_opts.client = new _opts.service(_opts.host + ':' + _opts.port, creds);

		console.log('Service: '.green + '%s', _opts.serviceName.yellow);
		console.log('Host: '.green + '%s', _opts.host.yellow);
		console.log('Port: '.green + '%s', _opts.port.yellow);
		console.log('Secure: '.green + '%s', _opts.insecure ? 'No'.red : 'Yes'.yellow);

		repl.setPrompt('[' + connection + '://' + _opts.host + ':' + _opts.port + ']#');
		repl.setOpts(_opts);
		repl.init();
	};

	this.init = function (opts) {
		_opts = opts;
		_identifyPackage(function () {
			_identifyService(function () {
				_createRepl();
			})
		});
	}
};

module.exports = new grpcli();
