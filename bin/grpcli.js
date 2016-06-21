#!/usr/bin/env node

'use strict';

var wait = require('wait.for');

var
	program = require('commander'),
	grpcli = require('../lib'),
	fs = require('fs'),
	ip = require('ip'),
	colors = require('colors'),
	conf = require('rc');

program
	.version("0.1.0")
	.usage('[options] [config]')
	.description('Specifying a config will attempt to load the `config` section from\n' +
		'  your .grpcli configuration file. Any command-line parameters you pass in\n' +
		'  will override what is configured in the .grpcli config file.')
	.option('-f, --file <file>', 'Absolute or relative path to the protobuf file\n' +
		'                       containing the gRPC service')
	.option('--ip <ip>', 'IP address of the gRPC service to connect to', null, '8080')
	.option('--port <port>', 'Port of the gRPC service to connect to', null, '127.0.0.1')
	.option('-d, --dir [directory]', 'Absolute or relative path to the directory\n' +
		'                       where protobuf files should be loaded from')
	.option('-s, --service [name]', 'Name of the gRPC service to connect to')
	.option('-i, --insecure', 'Whether to connect insecurely', false)
	.parse(process.argv);

var config_section;
if (program.args.length == 1) {
	config_section = program.args[0];
} else if (program.args.length > 1) {
	fatal('Error: '.red + 'Ambiguous project: `' + program.args.join(', ') + '`. Please only specify one project to load.');
}

var all_config = conf('grpcli');

var config = {};
if (config_section && !all_config[config_section]) {
	if (!all_config.config) {
		fatal('Error: '.red + ' Config file `~/.grpclirc` not found');
	}
	fatal('Error: '.red + 'Section `' + config_section + '` not found in ' + all_config.config);
} else if (all_config[config_section]) {
	console.log('Info: '.green + 'Using `%s` config from: %s', config_section.yellow, all_config.config);
	config = all_config[config_section];
}

var dir = program.dir || config.dir;
if (dir && dir.length > 0) {
	// remove any trailing slash
	if (dir.match(/.+\/$/)) {
		dir = dir.substr(0, dir.lastIndexOf('/'));
	}
	// convert provided directory to absolute
	if (!dir.match(/^\//)) {
		dir = process.cwd() + '/' + dir;
	}
	// ensure it exists
	if (!fs.existsSync(dir)) {
		fatal('Error: '.red + ' Directory does not exist: ' + dir);
	}
}

var file = program.file || config.file;
if (!file) {
	fatal('Error: '.red + 'Please provide a valid .proto file', true);
}
// turn proto into a relative path
if (file.match(/^\//)) {
	file = file.substr(file.lastIndexOf('/') + 1);
}

var root = process.cwd();
if (dir) {
	// use the provided directory
	root = dir;
} else if (file.match(/^\//)) {
	// .proto file is absolute path, use it
	root = file.substr(0, file.lastIndexOf('/'));
}

if (!fs.existsSync(root + '/' + file)) {
	fatal('Error: '.red + 'Could not find .proto file at ' + root + '/' + file);
}

var host = program.ip || config.ip;
if (!ip.isV4Format(host) && !ip.isV6Format(host)) {
	fatal('Error: '.red + 'Invalid IP address: ' + host);
}

var port = program.port || config.port;
if (!port.match(/^[0-9]{1,5}$/)) {
	fatal('Error: '.red + 'Invalid port: ' + port);
}

try {
	grpcli.init({
		proto_file: {
			root: root,
			file: file
		},
		host: host,
		port: port,
		service: (program.service || config.service),
		insecure: (program.insecure || config.insecure),
	});
} catch (e) {
	console.error('Error: '.red + 'Could not create gRPC client:');
	console.error(e);
	process.exit(1);
}

function fatal(message, with_help) {
	console.error(message);
	if (typeof(with_help) == 'undefined') {
		process.exit(1);
	}
	program.help();
}
