'use strict';

var grpc = require('grpc'),
	stdrepl = require('stdrepl'),
	prompt = require('prompt'),
	bnf = require('bnf'),
	compiler = new bnf.Compiler;

var grpcli = function () {

	var _opts = {};

	var _parser;

	var _replCommand = function () {

		var _section, _action, _extra, _command;

		var _calledCallback = false, _extraApplied = false;

		var _externalCallback = function () {
		};

		var _callback = function () {
			if (_calledCallback) {
				return;
			}
			_calledCallback = true;
			_externalCallback();
		};

		var _printHelp = function() {
			console.log('Available commands:');
			console.log('  help'.yellow);
			console.log('  quit'.yellow);
			console.log('  rpc'.yellow);
			console.log('  message'.yellow + ' (not implemented)'.gray);
			_callback();
		};

		var _printRpcHelp = function() {
			console.log('Available ' + 'rpc'.yellow + ' commands:');
			console.log('  list'.yellow + '                 - Lists all ' + _opts.serviceName.yellow + ' methods');
			console.log('  call'.yellow + ' <method>        - Calls the <method> method on ' + _opts.serviceName.yellow);
			console.log('  help'.yellow + '                 - Displays this help');
			_callback();
		};

		var _printMessageHelp = function() {
			console.log('Available ' + 'message'.yellow + ' commands:');
			console.log('  describe'.yellow +  '<message>   - Describes a protobuf message ' + '(not implemented)'.gray);
			_callback();
		};

		var _listGrpcMethods = function() {
			_printUsage();
			_callback();
		};

		var _callGrpcMethod = function() {
			var method;
			var parameters;
			if (_extra == '') {
				console.log('Error: '.red + 'Please provide a valid method to call');
				_printRpcHelp();
				return;
			}
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
			if (typeof(_opts.client[method]) !== 'function') {
				console.log('Error: '.red + 'Invalid method ' + method.blue.bold + ' specified');
				_callback();
				return;
			}
			console.log('Info: '.green + 'Calling ' + method.blue.bold + ' on ' + _opts.serviceName.yellow);
			try {
				_opts.client[method](parameters, function (err, response) {
					if (err) {
						console.log('Error: '.red + err.toString());
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
		};

		var _quit = function() {
			process.exit(0);
		};

		var _symbolTable = {
			'?' : _printHelp,
			'help' : _printHelp,
			'quit' : _quit,
			'q' : _quit,
			'rpc' : {
				'' : _printRpcHelp,
				'help' : _printRpcHelp,
				'?' : _printRpcHelp,
				'-h' : _printRpcHelp,
				'list' : _listGrpcMethods,
				'call' : _callGrpcMethod
			},
			'message' : {
				'' : _printMessageHelp,
				'help' : _printMessageHelp,
				'?' : _printMessageHelp,
				'-' : _printMessageHelp,
			}
		};

		var _executeCommand = function () {
			if (typeof(_symbolTable[_section]) === 'function') {
				_symbolTable[_section]();
			} else if (typeof(_symbolTable[_section][_action]) === 'function') {
				_symbolTable[_section][_action]();
			} else {
				console.log('Error: '.red + 'Invalid command supplied');
				_callback();
			}
		};

		this.applySection = function (section) {
			_section = section;
		};

		this.applyAction = function (action) {
			_action = action;
		};

		this.applyExtra = function (extra) {
			if (_extraApplied) {
				return;
			}
			_extraApplied = true;
			_extra = extra.trim();
		};

		this.createNewCommand = function (command, callback) {
			_command = command;
			_section = _action = _extra = '';
			_extraApplied = _calledCallback = false;
			if (typeof(callback) === 'function') {
				_externalCallback = callback;
			}
		};

		this.execute = function () {
			try {
				var result = _parser.ParseScriptString(_command);
				if (!result.rootToken.validated) {
					console.log('Error: '.red + 'Invalid command supplied: ' + _command);
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

	var _repl = new _replCommand();

	compiler.CompileScript(__dirname + "/grpcli.bnf", "grpcli", function (interpreter) {
		_parser = compiler.CreateParser(interpreter, {
			"section": function (token) {
				_repl.applySection(token.text);
			},
			"action": function (token) {
				_repl.applyAction(token.text);
			},
			"extra": function (token) {
				_repl.applyExtra(token.text);
			}
		});
	});

	var _identifyPackage = function (callback) {
		var proto = grpc.load(_opts.proto_file);

		_opts.proto = proto;

		var packages = Object.keys(proto);

		if (packages.length == 0) {
			console.errog('Error: '.red + 'No protobuf package found in .proto file: ' + _opts.proto.file);
		} else if (packages.length == 1) {
			_opts.package = packages[0];
			callback(_opts);
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
				callback(opts);
			});
		}
	};

	var _identifyService = function (callback) {
		console.log('Package: '.green + '%s', _opts.package.yellow);

		var def = _opts.proto[_opts.package];

		_opts.def = def;

		if (_opts.serviceName) {
			if (typeof(def[_opts.serviceName]) !== 'function') {
				throw new Error('Error: '.red + _opts.serviceName + ' does not exist in this .proto file');
			}
			_opts.service = def[_opts.serviceName];
			callback();
			return;
		}

		var services = [];
		Object.keys(def).forEach(function (property) {
			if (def[property].service) {
				services.push(def[property].service.name);
			}
		});
		if (services.length == 1) {
			_opts.serviceName = services[0];
			_opts.service = def[services[0]];
			callback();
			return;
		}
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
			_opts.serviceName = result.service;
			_opts.service = def[result.service];
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

		stdrepl.tabsize = 1;
		stdrepl.prompt = '[' + connection + '://' + _opts.host + ':' + _opts.port + ']#';

		stdrepl.eval = function (command, callback) {
			if (command && command.length > 0) {
				_repl.createNewCommand(command, callback)
				_repl.execute();
			} else {
				callback();
			}
		};
	};

	var _printUsage = function () {
		_opts.service.service.children.forEach(function (child) {
			console.log('%s(%s) {\n  return %s;\n}', (child.name.charAt(0).toLowerCase() + child.name.slice(1)).blue.bold, child.requestName, child.responseName);
		});
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

module.exports = {
	init: new grpcli().init
};