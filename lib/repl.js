var wait = require('wait.for'),
	bnf = require('bnf'),
	compiler = new bnf.Compiler,
	fs = require('fs');

var repl = function () {

	var _opts;

	var command = function () {

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

		var _printUsage = function () {
			_opts.service.service.children.forEach(function (child) {
				console.log('%s(%s) {\n  return %s;\n}', (child.name.charAt(0).toLowerCase() + child.name.slice(1)).blue.bold, child.requestName, child.responseName);
			});
		};

		var _printHelp = function () {
			console.log('Available commands:');
			console.log('  help'.yellow);
			console.log('  quit'.yellow);
			console.log('  rpc'.yellow);
			console.log('  message'.yellow + ' (not implemented)'.gray);
			_callback();
		};

		var _printRpcHelp = function () {
			console.log('Available ' + 'rpc'.yellow + ' commands:');
			console.log('  list'.yellow + '                 - Lists all ' + _opts.serviceName.yellow + ' methods');
			console.log('  call'.yellow + ' <method>        - Calls the <method> method on ' + _opts.serviceName.yellow);
			console.log('  help'.yellow + '                 - Displays this help');
			_callback();
		};

		var _printMessageHelp = function () {
			console.log('Available ' + 'message'.yellow + ' commands:');
			console.log('  describe'.yellow + '<message>   - Describes a protobuf message ' + '(not implemented)'.gray);
			_callback();
		};

		var _listGrpcMethods = function () {
			_printUsage();
			_callback();
		};

		var _callGrpcMethod = function () {
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

		var _quit = function () {
			process.exit(0);
		};

		var _symbolTable = {
			'?': _printHelp,
			'help': _printHelp,
			'quit': _quit,
			'q': _quit,
			'rpc': {
				'': _printRpcHelp,
				'help': _printRpcHelp,
				'?': _printRpcHelp,
				'-h': _printRpcHelp,
				'list': _listGrpcMethods,
				'call': _callGrpcMethod
			},
			'message': {
				'': _printMessageHelp,
				'help': _printMessageHelp,
				'?': _printMessageHelp,
				'-': _printMessageHelp,
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

	var _command = new command();

	var _parser;

	compiler.CompileScript(__dirname + "/grpcli.bnf", "grpcli", function (interpreter) {
		_parser = compiler.CreateParser(interpreter, {
			"section": function (token) {
				_command.applySection(token.text);
			},
			"action": function (token) {
				_command.applyAction(token.text);
			},
			"extra": function (token) {
				_command.applyExtra(token.text);
			}
		});
	});

	var _nop = function () {
	};

	var _getUserHome = function () {
		return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
	};

	var _tabsize = 1,
		_prompt = '>>',
		_index = 127,
		_action = [_nop],
		_margin = 0,
		_cursor = 0,
		_line = '',
		_history = [],
		_current = '',
		_historyFile = _getUserHome() + '/.grpcli_history';

	var _eval = function (command, callback) {
		if (command && command.length > 0) {
			_command.createNewCommand(command, callback);
			_command.execute();
		} else {
			callback();
		}
	};

	if (!fs.existsSync(_historyFile)) {
		fs.closeSync(fs.openSync(_historyFile, 'w'));
	}

	// TODO: limit this to some reasonable number of entries
	var historyFileContents = fs.readFileSync(_historyFile, 'utf8');
	if (historyFileContents && historyFileContents.length) {
		historyFileContents = historyFileContents.trim().split('\n');
		for (var i = 0; i < historyFileContents.length; ++i) {
			try {
				var entry = JSON.parse(historyFileContents[i]);
				_history.push(entry.command);
			} catch (ignored) {
			}
		}
	}

	var _setControl = function (char, handler) {
		_action[char.charCodeAt(0) - 64 & 127] = handler;
	};

	var _stdin = process.stdin;
	var _stdout = process.stdout;

	var _resetLine = function () {
		_line = _line.slice(_cursor);
		_margin = _cursor = _decolorizedPrompt().length + 1;
		_line = _decolorizedPrompt() + (_line === " " ? "" : " ") + _line;
		_stdout.write(_prompt + "\x1B[" + (_cursor + 1) + "G");
	};

	var _decolorizedPrompt = function () {
		return _prompt.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
	};

	var commandExecutionInProgress = false;
	var _executeCommandSync = function () {
		if (commandExecutionInProgress) {
			return;
		}
		_cursor = _line.length;
		_stdout.write("\x1B[" + (_cursor + 1) + "G");
		commandExecutionInProgress = true;
		_current = _line.slice(_margin, _cursor);
		if (_current.trim() != "") {
			_index = _history.push(_current);
			var historyLine = JSON.stringify({
					"pid": process.pid,
					"date": new Date(),
					"command": _current
				}) + "\n";
			fs.appendFileSync(_historyFile, historyLine);
		}
		_stdout.write("\x1B[0K\n");

		var args = _eval.toString().match(/^\s*function\s+(?:\w*\s*)?\((.*?)\)/);
		args = args ? (args[1] ? args[1].trim().split(/\s*,\s*/) : []) : null;

		if (args.length == 2) {
			wait.for(_eval, _current);
		} else {
			_eval();
		}

		_resetLine();

		commandExecutionInProgress = false;
	};

	var _print = function (string) {
		var rest = _line.slice(_cursor);
		_line = _line.slice(0, _cursor) + string + rest;
		_stdout.write("\x1B[0K" + string + "\x1B[s" + rest + "\x1B[u");
		_cursor += string.length;
	};

	while (_index) {
		_action.unshift(_index-- > 32 ? _print : _nop);
	}

	var _exit = function () {
		_stdout.write("\n");
		process.exit(0);
	};

	var _setCursor = function (position) {
		_cursor = position++;
		_stdout.write("\x1B[" + position + "G");
	};

	_setControl("M", function () {
		wait.launchFiber(_executeCommandSync);
	});

	_setControl("C", _exit);
	_setControl("D", _exit);

	_setControl("I", function () {
		_print(new Array(_tabsize + 1 - (_cursor - _margin) % _tabsize).join(" "));
	});

	_setControl("[", function (key) {
		switch (key.slice(1)) {
			case "[3~":
				if (_cursor < _line.length) {
					var rest = _line.slice(_cursor + 1);
					_line = _line.slice(0, _cursor) + rest;
					_stdout.write("\x1B[0K\x1B[s" + rest + "\x1B[u");
				}
				break;
			case "[A":
				if (_index) {
					if (_index-- === _history.length) _current = _line.slice(_margin);
					_line = _line.slice(0, _margin) + _history[_index];
					_stdout.write("\x1B[2K\x1B[1G" + _prompt + " " + _history[_index]);
					_cursor = _line.length;
				}
				break;
			case "[B":
				if (_index < _history.length) {
					var nextLine = ++_index < _history.length ? _history[_index] : _current;
					_line = _line.slice(0, _margin) + nextLine;
					_stdout.write("\x1B[2K\x1B[1G" + _prompt + " " + nextLine);
					_cursor = _line.length;
				}
				break;
			case "[C":
				if (_cursor < _line.length) {
					_stdout.write(key);
					_cursor++;
				}
				break;
			case "[D":
				if (_cursor > _margin) {
					_stdout.write(key);
					_cursor--;
				}
				break;
			case "OF":
				_setCursor(_line.length);
				break;
			case "OH":
				_setCursor(_margin);
				break;
		}
	});

	_setControl("A", function () {
		_setCursor(_decolorizedPrompt().length + 1);
	});

	_setControl("E", function () {
		var current = _line.slice(_margin);
		_setCursor(_decolorizedPrompt().length + current.length + 1);
	});

	_setControl("U", function () {
		_current = _line.slice(_cursor);
		_line = _decolorizedPrompt() + " " + _current;
		_setCursor(0);
		_stdout.write("\x1B[2K");
		_stdout.write(_prompt + " " + _current + "\x1B[" + (_cursor + 1) + "G");
		_cursor = _decolorizedPrompt().length + 1;
		_setCursor(_cursor);
	});

	_setControl("?", function () {
		if (_cursor > _margin) {
			var rest = _line.slice(_cursor);
			_line = _line.slice(0, --_cursor) + rest;
			_stdout.write("\x08\x1B[0K\x1B[s" + rest + "\x1B[u");
		}
	});

	_stdin.on("data", function (key) {
		var code = key.charCodeAt(0);

		if (code !== 0x1B) {
			var length = key.length;
			for (var i = 0; i < length; i++) {
				_action[key.charCodeAt(i)](key.charAt(i));
			}
		} else {
			_action[code](key);
		}
	});

	this.setOpts = function (opts) {
		_opts = opts;
	};

	this.setPrompt = function (prompt) {
		_prompt = prompt;
	};

	this.init = function () {
		var prompt = _prompt;
		prompt = prompt.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
		_margin = _cursor = prompt.length + 1;
		_line = prompt + " ";
		_stdout.write(_prompt + " ");

		_index = _history.length;

		_stdin.setEncoding("utf8");
		_stdin.setRawMode(true);
		_stdin.resume();
	};
};

module.exports = new repl();