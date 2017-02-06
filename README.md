# grpcli

`grpcli` is a command-line client for gRPC.

### Features

* Connect to any gRPC service
* List all available gRPC methods from a service
* Call any gRPC method passing native javascript objects that get converted to protobuf messages
* Automatically reconnect via standard gRPC backoff retries

### Installation

`npm install -g grpcli`

### Prerequisites

* A gRPC service listening on a reachable IP and port
* The `.proto` file describing the gRPC service
* `npm` installed

### Using grpcli

Command-line arguments can be passed in via CLI flags, for example:

```
[user@host]# grpcli -f myservice.proto --ip=127.0.0.1 --port=3466
```

#### Configuration File

You can place any necessary configuration in an `.grpclirc` file in your home directory.

```
[config1]
ip = 127.0.0.1
port = 8080
dir = /path/to/proto/files1
file = my1.proto
insecure = true

[config2]
ip = 192.168.1.1
port = 8888
dir = /path/to/proto/files2
file = my2.proto
insecure = false
```

To load up a specific configuration, pass in the section:

```
[user@host]# grpcli config1
```

Or

```
[user@host]# grpcli config2
```

#### Making Calls

Once you are connected you will be able list and make calls to the gRPC service:

```
[user@host]# grpcli config1
Info: Using `config1` config from: /home/user/.grpclirc
Package: mypackage
Service: MyService
Host: 127.0.0.1
Port: 8080
Secure: Yes
[grpc+insecure://127.0.0.1:8080]# rpc list
listObjects(ListObjectsRequest) {
  return ListObjectsResponse;
}
createObject(CreateObjectRequest) {
  return CreateObjectResponse;
}
[grpc+insecure://127.0.0.1:8080]# rpc call listObjects {"offset":0,"limit":10}
{
  "objects": {
    "objects": []
  }
}
```

### Command-line Options

```
  Usage: grpcli [options] [config]

  Specifying a config will attempt to load the `config` section from
  your .grpcli configuration file. Any command-line parameters you pass in
  will override what is configured in the .grpcli config file.

  Options:

    -h, --help             output usage information
    -V, --version          output the version number
    -f, --file <file>      Absolute or relative path to the protobuf file
                           containing the gRPC service
    --ip <ip>              IP address of the gRPC service to connect to
    --port <port>          Port of the gRPC service to connect to
    -d, --dir [directory]  Absolute or relative path to the directory
                           where protobuf files should be loaded from
    -s, --service [name]   Name of the gRPC service to connect to
    -i, --insecure         Whether to connect insecurely
```

### Versions

#### 0.7.5

- Update grpc dependency to ^1.1.1 (@jab)

#### 0.7.4

- Add support for `.grpcli_history` file
- Proper error message for missing `.grpclirc` config file

#### 0.7.3

- Remove unnecessary harmony
- Fixes issue with installing `grpcli`
- Implement REPL internally

#### 0.6.4

- Better error display
- Fix `message` command in `grpcli.bnf`
- Add `quit` command
- Fix reference to `grpcli.bnf`
- Restructuring and code cleanup
- Remove unused `wait`

#### 0.1.0

- Initial release

### License

BSD-2-Clause

```
Copyright (c) 2016, Nathan Goulding
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### Notes

* The inspiration for `grpcli` was Neil Jagdish Patel's [grpcc](https://github.com/njpatel/grpcc).
* This uses a basic context-free grammar located in grpcli.bnf

### Contact

Nathan Goulding

[Github](https://github.com/nathangoulding)
