/*
node client_topic_queue.js worker
node client_topic_queue.js master
 */

let NodeRabbitConnector = require('../dist/index').default;

let role = process.argv[2];
if(!role) role = 'worker'; // || master

let clientName = process.argv[3];
if(!clientName) clientName = 'testClient' + Math.random();

let interval = process.argv[4];
if(!interval) interval = 2000;

let topic = process.argv[5];
if(!topic) topic = 'standard_topic';

let exchange = process.argv[6];
if(!exchange) exchange = 'standard_exchange';


let messageCounter = 0;

let connector = new NodeRabbitConnector();

connector.connect()
  .then(() => {

    if(role !== 'master' && !!topic) {
      connector.setTopicListener(exchange, topic, false, (msg) => {
        let message = connector.deserialize(msg);
        if (message.msg) {
          console.log('Message received from topic ' + topic + ': ' + message.msg);
        }
      });
    }

    if(role === 'master' && !!topic) {
      setInterval(() => {
        connector.sendToTopic(exchange, topic, {msg: "testLogMessage " + messageCounter ++}, false);
        console.log('sent to topic queue');
      }, interval);
    }
  })
  .catch(err => {
    console.log(err);
  });
