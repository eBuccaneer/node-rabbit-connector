/*
node client_work_queue.js worker
node client_work_queue.js master
 */
let NodeRabbitConnector = require('../dist/index').default;

let role = process.argv[2];
if(!role) role = 'worker'; // || master

let clientName = process.argv[3];
if(!clientName) clientName = 'testClient' + Math.random();

let interval = process.argv[4];
if(!interval) interval = 2000;

let taskQueue = process.argv[5];
if(!taskQueue) taskQueue = 'standard_task_queue';

let messageCounter = 0;

let connector = new NodeRabbitConnector();

connector.connect()
  .then(() => {

    if(role !== 'master' && !!taskQueue) {
      connector.setWorkQueueListener(taskQueue, false, (msg) => {
        let message = connector.deserialize(msg);
        if (message.msg) {
          console.log('Message received in taskQueue ' + taskQueue + ': ' + message.msg);
        } else {
          console.log('Object received in taskQueue ' + taskQueue + ':');
          console.log(message.data);
        }
        setTimeout(function () {
          console.log(" [x] Done in taskQueue " + taskQueue);
          connector.ack(msg);
        }, interval * 1.5);
      });
    }

    if(role === 'master' && !!taskQueue) {
      setInterval(() => {
        connector.sendToWorkQueue(taskQueue, {data: {clientName: clientName, counter: messageCounter ++}});
        console.log('sent to work queue');
      }, interval);
    }
  })
  .catch(err => {
    console.log(err);
  });
