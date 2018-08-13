# node-rabbit-connector

## ATTENTION: This module is currently in alpha development phase, please use  at your own risk!

## Description
The module node-rabbit-connector is a simple interface for easily connecting to rabbitmq 
using amqplib written in typescript. It is useful for quick development but by far not as flexible as the
original amqplib. This is also the greatest advantage, not having to deal with more complexity.
It can be used for connecting to any amqp implementation, but it is only tested with rabbitmq.


## Install
Using npm:
```bash
npm install --save node-rabbit-connector
```
Using yarn:
```bash
yarn add node-rabbit-connector
```


## Usage
### Initialize
```
// create options object (if not used with default options)
let options = {hostUrl: "amqp://localhost"};

// initialize connector
let connector = new NodeRabbitConnector(options);

// connect to rabbitmq
await connector.connect();

// do stuff here
```

### Options
The RabbitConnectorOptions object with it's default values. The defaults are applied if no options
 object is passed to the constructor.
```
let options: RabbitConnectorOptions = {
  // if true, the the connector tries to connect to rabbitmq till the first connection is established
  reconnect: boolean = true;
    
  // interval in milliseconds that indicates sleep time between connects
  reconnectInterval: number = 2000;
    
  // the url for connecting to rabbitmq instance
  hostUrl: string = "amqp://localhost";
    
  // indicates the maximum number of unacknowledged messages per consumer
  channelPrefetchCount: number = 1;
    
  // if true, debug output is printed to console
  debug: boolean = false;
}
```

### Sending and Receiving Messages
This sections shows how to send and receive different messages.

#### RPC Calls
Consumer:
```
// function signature
public async setRPCListener(
  name: string, // the name of the rpc, for identification
  consumerCallback: (msg: Message | null) => any, // the callback that is called on message reception
  highPriority?: boolean // if true, the message is delivered with high priority
): Promise<string>; // returns a consumerTag, required to cancel consumer later on                         
```
                            
```
// example usage                                
connector.setRPCListener("standard_rpc", async (msg) => {
  // deserialize message
  let message: RabbitConnectorMessage = connector.deserialize(msg); 
        
  // do work and create response
  let response: RabbitConnectorMessage = {
    msg: foo(), 
    corrId: message.corrId, 
    replyTo: message.replyTo
  }
       
  // acknowledge work done
  connector.ack(msg);
  
  // send response
  await connector.replyToRPC(response);
});                                
```

Sender:
```
// function signature
public async sendRPC(name: string, msg: RabbitConnectorMessage, highPriority?: boolean):
                        Promise<RabbitConnectorMessage>
                        
public async sendRPC(
  name: string, // the name of the rpc, for identification
  msg: RabbitConnectorMessage // the actual message
  highPriority?: boolean // if true, the message is delivered with high priority
): Promise<RabbitConnectorMessage>; // returns a RabbitConnectorMessage as response                         
``` 

```
let response: RabbitConnectorMessage = await connector.sendRPC(
        "standard_rpc", {data: {name: "testName, counter: testCounter++}}
);
```

#### Work Queues
Consumer:
```

```

Sender:
```

```

#### Topic Queues
Consumer:
```

```

Sender:
```

```

#### Messages
The RabbitConnectorMessage interface.
```
let message: RabbitConnectorMessage = {
  // message content
  msg?: string;

  // data content
  data?: any;

  // error key
  error?: string;

  // correlation ID for use with rpc calls
  corrId?: string;

  // response queue name for use with rpc calls
  replyTo?: string;

  // json web token for access control
  jwt?: string;
}
```


## License
This code available under the MIT License.
See License.md for details.