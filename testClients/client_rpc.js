/*
node client_rpc.js worker
node client_rpc.js master
 */

let NodeRabbitConnector = require('../dist/index').default;

let role = process.argv[2];
if(!role) role = 'worker'; // || master

let clientName = process.argv[3];
if(!clientName) clientName = 'testClient' + Math.random();

let interval = process.argv[4];
if(!interval) interval = 2000;

let rpc = process.argv[5];
if(!rpc) rpc = 'standard_rpc';

let messageCounter = 0;

let connector = new NodeRabbitConnector();

connector.connect()
  .then(() => {

    if(role !== 'master' && !!rpc) {
      connector.setRPCListener(rpc, (msg) => {
        let message = connector.deserialize(msg);
        if(message.data.name){
          console.log("rpc call received from " + message.data.name + "with counter " + message.data.counter);
          connector.ack(msg);
          connector.replyToRPC({msg: "Hello " + message.data.name, corrId: message.corrId, replyTo: message.replyTo})
            .then(() => {
              console.log("responded to rpc call from " + message.data.name);
            })
            .catch((err) => {
              console.error(err);
            })
        } else{
          console.error("couldnt respond to rpc");
        }
      });
    }

    if(role === 'master' && !!rpc) {
      setInterval(() => {
        console.log('sending to rpc in progress');
        connector.sendRPC(rpc, {data: {name: clientName, counter: messageCounter++}})
          .then((msg) => {
            console.log(msg.msg);
          })
          .catch((err) => {
            console.error(err);
          })
      }, interval);
    }

  })
  .catch(err => {
    console.log(err);
  });
