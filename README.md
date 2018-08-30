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
    
  // interval in milliseconds that indicates sleep time between connects when first connecting
  reconnectInterval: number = 2000;
    
  // maximum attempts to reconnect on start
  reconnectTries: number = 2000;
    
  // the url for connecting to rabbitmq instance
  hostUrl: string = "amqp://localhost";
    
  // indicates the maximum number of unacknowledged messages per consumer
  channelPrefetchCount: number = 1;
    
  // indicates if process should be killed if disconnected
  exitOnDisconnectError: boolean = true;
    
  // if true, debug output is printed to console
  // if given a function, it is called with (msg: string, isErr: boolean, exit: boolean) instead of printing to console
  debug: boolean | ((msg: string, isErr?: boolean, exit?: boolean) => void) = false;
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
  /*
    if true, the message is delivered with high priority,
    this has to be the same for sender and consumer
  */
  highPriority?: boolean
): Promise<string>; // returns a consumerTag, required to cancel consumer later on                         
```
                            
```
// example usage                                
connector.setRPCListener("standard_rpc", async (msg: Message | null) => {
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
public async sendRPC(
  name: string, // the name of the rpc, for identification
  msg: RabbitConnectorMessage // the actual message
  /*
    if true, the message is delivered with high priority,
    this has to be the same for sender and consumer
  */
  highPriority?: boolean
): Promise<RabbitConnectorMessage>; // returns a RabbitConnectorMessage as response                         
``` 

```
// example usage  
let response: RabbitConnectorMessage = await connector.sendRPC(
        "standard_rpc", {data: {name: "testName", counter: testCounter++}}
);
```

#### Work Queues
Consumer:
```
// function signature
public async setWorkQueueListener(
  queueName: string, // the name of the work queue, for identification
  noAck: boolean, // if true, no message ackknowledgement is needed
  consumerCallback: (msg: Message | null) => any  // the callback that is called on message reception
): Promise<string> // returns a consumerTag, required to cancel consumer later on  
```

```
// example usage  
connector.setWorkQueueListener("taskQueue", false, (msg: Message | null) => {
  // deserialize message
  let message: RabbitConnectorMessage = connector.deserialize(msg);
  
  // do stuff with message here
  
  // ackknowledge message
  connector.ack(msg);
}
```

Sender:
```
// function signature
public async sendToWorkQueue (
  queueName: string, // the name of the work queue, for identification
  msg: RabbitConnectorMessage // the actual message
);
```

```
// example usage  
connector.sendToWorkQueue("taskQueue", {data: {name: "testName", counter: testCounter++}});
```

#### Topic Queues
Consumer:
```
// function signature
public async setTopicListener(
  exchange: string, // the name of the exchange to attach the consumer to
  key: string, // the name of the topic to listen to
  /*
    if yes, the exchange and the queue will survive broker restarts,
    this has to be the same for sender and consumer
  */
  durable: boolean,
  consumerCallback: (msg: Message | null) => any // the callback that is called on message reception
): Promise<string>;// returns a consumerTag, required to cancel consumer later on
```

```
// example usage  
connector.setTopicListener("defaultExchange", "someTopic", false, (msg: Message | null) => {
  let message: RabbitConnectorMessage = connector.deserialize(msg);
  // do something with the message here
});
```

Sender:
```
// function signature
public async sendToTopic(
  exchange: string, // the name of the exchange to send the message to
  key: string, // the name of the topic the message relates to
  msg: RabbitConnectorMessage, // the actual message
  /*
    if yes, the exchange to send to survives broker restarts,
    this has to be the same for sender and consumer
  */
  durable: boolean
)
```

```
// example usage  
connector.sendToTopic("defaultExchange", "someTopic", {msg: "testLogMessage"}, false);
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