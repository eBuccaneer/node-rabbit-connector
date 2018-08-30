import * as amqp from "amqplib";
import { Message, Replies } from "amqplib";
import { v4 } from "uuid";
import RabbitConnectorMessage from "./types/rabbitConnectorMessage";
import RabbitConnectorOptions from "./types/rabbitConnectorOptions";
const _get = require("lodash/get");
const _isFunction = require("lodash/isFunction");


/*
    simple interface for connecting to rabbitmq using amqplib (amqp in general, but only tested with rabbitmq)
 */
export default class NodeRabbitConnector {

    private hostUrl: string;
    private reconnect: boolean;
    private reconnectTries: number;
    private reconnectCounter = 0;
    private reconnectInterval: number;
    private exitOnDisconnectError: boolean;
    private debug: boolean | ((msg: string, isErr?: boolean) => void);
    private channelPrefetchCount: number;
    private connection?: amqp.Connection;
    private channel?: amqp.Channel;

    constructor(options: RabbitConnectorOptions = {}) {
        this.hostUrl = <string> _get(options, "hostUrl", "amqp://localhost");
        this.reconnect = <boolean>_get(options, "reconnect", true);
        this.reconnectInterval = <number> _get(options, "reconnectInterval", 2000);
        if (_isFunction(options.debug)) {
            this.debug = <(msg: string, isErr?: boolean) => void> options.debug;
        } else {
            this.debug = <boolean> _get(options, "debug", false);
        }
        this.channelPrefetchCount = <number> _get(options, "channelPrefetchCount", 1);
        this.reconnectTries = <number> _get(options, "reconnectTries", 20);
        this.exitOnDisconnectError = <boolean>_get(options, "exitOnDisconnectError", true);
        this.channel = undefined;
        this.connection = undefined;

        if (!options && this.debug) this.log("[NodeRabbitConnector] No options given.");
    }

    /*
        connects the connector to rabbitmq, if successful a channel connection is established afterwards
     */
    public async connect() {
        try {
            this.log(`[NodeRabbitConnector] connecting to host ${this.hostUrl} ...`);
            this.connection = await amqp.connect(this.hostUrl);
            this.connection.on("close", (err) => {
                this.log(err, true, true);
            });
            this.log(`[NodeRabbitConnector] connection to host ${this.hostUrl} established.`);
            await this.connectChannel();
            return Promise.resolve();
        } catch (err) {
            this.log(`[NodeRabbitConnector] connecting to host ${this.hostUrl} failed.`, true);
            if (this.reconnect && this.reconnectCounter < this.reconnectTries) {
                this.log(`[NodeRabbitConnector] reconnecting to host ${this.hostUrl} ...`);
                this.reconnectCounter ++;
                const self = this;
                await new Promise(async (resolve, reject) => {
                    setTimeout(async () => {
                        try {
                            await self.connect();
                            self.reconnectCounter = 0;
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    }, this.reconnectInterval);
                });
            } else {
                return Promise.reject(err);
            }
        }
    }

    /*
        connects a channel to the established connection
     */
    private async connectChannel() {
        try {
            if (!!this.connection) {
                this.log("[NodeRabbitConnector] connecting to channel ...");
                this.channel = await this.connection.createChannel();
                this.log("[NodeRabbitConnector] connected to channel. Setting prefetch count ...");
                await this.channel.prefetch(this.channelPrefetchCount, false);
                this.log("[NodeRabbitConnector] prefetch count set. Ready to process some messages.");
                return Promise.resolve();
            } else {
                return Promise.reject(
                    new Error(`[NodeRabbitConnector] connection is not established, 
                                                connecting to channel not possible.`));
            }
        } catch (err) {
            this.log("[NodeRabbitConnector] connecting to channel failed.", true);
            if (this.reconnect && this.reconnectCounter < this.reconnectTries) {
                this.log("[NodeRabbitConnector] reconnecting to channel ...");
                this.reconnectCounter ++;
                const self = this;
                await new Promise(async (resolve, reject) => {
                    setTimeout(async () => {
                        try {
                            await self.connectChannel();
                            self.reconnectCounter = 0;
                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    }, this.reconnectInterval);
                });
            } else {
                return Promise.reject(err);
            }
        }
    }

    /*
        attaches an rpc consumer
     */
    public async setRPCListener(name: string, consumerCallback: (msg: Message | null) => any,
                                highPriority?: boolean): Promise<string> {
        try {
            if (!!this.channel) {
                const self = this;
                const wrapper = (msg: Message | null): any => {
                    self.log(`[NodeRabbitConnector] rpc request message received.`);
                    consumerCallback(msg);
                };

                this.log(`[NodeRabbitConnector] trying to listen to rpc ${name} ...`);
                await this.channel.assertQueue(name, {durable: true, maxPriority: highPriority ? 255 : 1});

                const response: Replies.Consume =
                    await this.channel.consume(name, wrapper, {noAck: false});
                this.log(`[NodeRabbitConnector] listening to rpc ${name} ...`);
                return Promise.resolve(response.consumerTag);
            } else {
                return Promise.reject(
                    new Error(`[NodeRabbitConnector] channel not open so listening 
                                                to rpc ${name} not possible.`));
            }
        } catch (err) {
            this.log(`[NodeRabbitConnector] setting listener for rpc ${name} failed.`, true);
            return Promise.reject(err);
        }
    }

    /*
        function to call by an rpc consumer after rpc work is done
     */
    public async replyToRPC(msg: RabbitConnectorMessage) {
        try {
            if (!!this.channel && msg.replyTo && msg.corrId) {
                this.log(`[NodeRabbitConnector] trying to reply to rpc ${msg.replyTo} with corrId ${msg.corrId} ...`);
                await this.channel.sendToQueue(msg.replyTo, this.serialize(msg), {persistent: true});
                this.log(`[NodeRabbitConnector] replied to rpc ${msg.replyTo} with corrId ${msg.corrId} ...`);
                return Promise.resolve();
            } else {
                return Promise.reject(
                    new Error(`[NodeRabbitConnector] channel not open or corrId or replyTo properties
                                                not set so sending to rpc not possible.`));
            }
        } catch (err) {
            this.log(`[NodeRabbitConnector] replying rpc failed.`, true);
            return Promise.reject(err);
        }
    }

    /*
        makes an rpc call, this can be answered by any consumer attached to the specific rpc call
     */
    public async sendRPC(name: string, msg: RabbitConnectorMessage, highPriority?: boolean):
                        Promise<RabbitConnectorMessage> {
        const self = this;
        return new Promise<RabbitConnectorMessage>(async (resolve, reject) => {
            try {
                if (!!self.channel) {
                    self.log(`[NodeRabbitConnector] trying to send rpc ${name} ...`);
                    const assertedResponseQueue: Replies.AssertQueue =
                        await self.channel.assertQueue("",
                            {autoDelete: true, maxPriority: highPriority ? 255 : 1});
                    const corrId = v4();
                    const replyTo: string = assertedResponseQueue.queue;
                    msg.replyTo = replyTo;
                    msg.corrId = corrId;
                    const responseConsumerTag: string = replyTo + name + corrId;
                    await self.channel.consume(replyTo, (msg: Message | null) => {
                        const responseRabbitConnectorMessage = self.deserialize(msg);
                        if (corrId === responseRabbitConnectorMessage.corrId) {
                            if (!!self.channel) {
                                self.channel.cancel(responseConsumerTag)
                                    .then(() => {
                                        self.log(`[NodeRabbitConnector] canceled rpc response
                                                            consumer ${responseConsumerTag}.`);
                                    })
                                    .catch(error => {
                                        self.log(`[NodeRabbitConnector] cancelling rpc response consumer 
                                                            ${responseConsumerTag} failed.`, true);
                                    });
                            }
                            self.log(`[NodeRabbitConnector] response of rpc ${name} received.`);
                            return resolve(responseRabbitConnectorMessage);
                        } else {
                            self.log(`Message is ignored because corrId's are not matching.`);
                        }
                    }, {noAck: true, exclusive: true, consumerTag: responseConsumerTag});
                    await self.channel.assertQueue(name, {durable: true, maxPriority: highPriority ? 255 : 1});
                    await self.channel.sendToQueue(name, self.serialize(msg), {persistent: true});
                    self.log(`[NodeRabbitConnector] sending rpc ${name} done.`);
                } else {
                    return reject(
                        new Error(`[NodeRabbitConnector] channel not open so sending 
                                                rpc ${name} not possible.`));
                }
            } catch (err) {
                self.log(`[NodeRabbitConnector] sending rpc ${name} failed.`, true);
                return reject(err);
            }
        });
    }

    /*
        attaches a work queue consumer
     */
    public async setWorkQueueListener(queueName: string, noAck: boolean,
                                      consumerCallback: (msg: Message | null) => any): Promise<string> {
        try {
            if (!!this.channel) {
                const self = this;
                const wrapper = (msg: Message | null): any => {
                    self.log(`[NodeRabbitConnector] work queue request message received.`);
                    consumerCallback(msg);
                };

                this.log(`[NodeRabbitConnector] trying to listen to work queue ${queueName} ...`);
                await this.channel.assertQueue(queueName, {durable: true});
                const response: Replies.Consume =
                    await this.channel.consume(queueName, wrapper, {noAck});
                this.log(`[NodeRabbitConnector] listening to work queue ${queueName} ...`);
                return Promise.resolve(response.consumerTag);
            } else {
                return Promise.reject(
                    new Error(`[NodeRabbitConnector] channel not open so listening 
                                                to work queue ${queueName} not possible.`));
            }
        } catch (err) {
            this.log(`[NodeRabbitConnector] setting work queue listener for queue ${queueName} failed.`, true);
            return Promise.reject(err);
        }
    }

    /*
        sends a message to a work queue, this will be received by only 1 consumer attached to the work queue
     */
    public async sendToWorkQueue (queueName: string, msg: RabbitConnectorMessage) {
        try {
            if (!!this.channel) {
                this.log(`[NodeRabbitConnector] trying to send to work queue ${queueName} ...`);
                await this.channel.assertQueue(queueName, {durable: true});
                await this.channel.sendToQueue(queueName, this.serialize(msg), {persistent: true});
                this.log(`[NodeRabbitConnector] sending to work queue ${queueName} done.`);
                return Promise.resolve();
            } else {
                return Promise.reject(
                    new Error(`[NodeRabbitConnector] channel not open so sending 
                                                to work queue ${queueName} not possible.`));
            }
        } catch (err) {
            this.log(`[NodeRabbitConnector] sending to work queue ${queueName} failed.`, true);
            return Promise.reject(err);
        }
    }

    /*
        attaches a topic consumer
     */
    public async setTopicListener(exchange: string, key: string, durable: boolean,
                                       consumerCallback: (msg: Message | null) => any): Promise<string> {
        try {
            if (!!this.channel) {
                const self = this;
                const wrapper = (msg: Message | null): any => {
                    self.log(`[NodeRabbitConnector] topic message received.`);
                    consumerCallback(msg);
                };

                this.log(`[NodeRabbitConnector] trying to listen to topic with key ${key} on exchange ${exchange} ...`);
                await this.channel.assertExchange(exchange, "topic", {durable});
                const assertedQueue: Replies.AssertQueue =
                    await this.channel.assertQueue("", {exclusive: true, durable});
                await this.channel.bindQueue(assertedQueue.queue, exchange, key);
                const response: Replies.Consume = await this.channel.consume(assertedQueue.queue, wrapper, {noAck: true});
                this.log(`[NodeRabbitConnector] listening to topic with key ${key} on exchange ${exchange} ...`);
                return Promise.resolve(response.consumerTag);
            } else {
                return Promise.reject(
                    new Error(`[NodeRabbitConnector] channel not open so listening 
                                                to topic with key ${key} on exchange ${exchange} not possible.`));
            }
        } catch (err) {
            this.log(`[NodeRabbitConnector] setting topic listener with key ${key} 
                            on exchange ${exchange} failed.`, true);
            return Promise.reject(err);
        }
    }

    /*
        sends a message to a specific topic, this will be received by all consumeres attached to this topic
     */
    public async sendToTopic(exchange: string, key: string, msg: RabbitConnectorMessage, durable: boolean) {
        try {
            if (!!this.channel) {
                this.log(`[NodeRabbitConnector] trying to send to topic with key ${key} on exchange ${exchange} ...`);
                await this.channel.assertExchange(exchange, "topic", {durable});
                await this.channel.publish(exchange, key, this.serialize(msg));
                this.log(`[NodeRabbitConnector] sending to topic with key ${key} on exchange ${exchange} done.`);
                return Promise.resolve();
            } else {
                return Promise.reject(
                    new Error(`[NodeRabbitConnector] channel not open so sending 
                                                to topic with key ${key} on exchange ${exchange} not possible.`));
            }
        } catch (err) {
            this.log(`[NodeRabbitConnector] sending to topic with key ${key} on exchange ${exchange} failed.`, true);
            return Promise.reject(err);
        }
    }

    /*
        stops listening by a specific consumer identified by @consumerTag
     */
    public async stopListening(consumerTag: string) {
        try {
            if (!!this.channel) {
                this.log(`[NodeRabbitConnector] trying to cancel listener with consumer tag ${consumerTag} ...`);
                await this.channel.cancel(consumerTag);
                this.log(`[NodeRabbitConnector] listener with consumer tag ${consumerTag} canceled.`);
                return Promise.resolve();
            } else {
                return Promise.reject(
                    new Error(`[NodeRabbitConnector] channel not open so cancelling the listener 
                                                with consumer tag ${consumerTag} not possible.`));
            }
        } catch (err) {
            this.log(`[NodeRabbitConnector] cancelling the listener with consumer tag ${consumerTag} failed.`, true);
            return Promise.reject(err);
        }
    }

    private log(msg: string, isErr?: boolean, exit?: boolean) {
        if (this.debug) {
            if (_isFunction(this.debug)) {
                return (<(msg: string, isErr?: boolean, exit?: boolean) => void> this.debug)(msg, isErr, exit);
            } else {
                if (isErr) {
                    console.error(msg);
                    if (exit && this.exitOnDisconnectError) setTimeout(process.exit(1), 2000);
                } else {
                    console.log(msg);
                }
            }
        } else if (isErr) {
            console.error(msg);
            if (exit && this.exitOnDisconnectError) setTimeout(process.exit(1), 2000);
        }
    }

    private serialize(msg: RabbitConnectorMessage): Buffer {
        return new Buffer(JSON.stringify(msg));
    }

    /*
        deserializes a rabbitmq message to a RabbitConnectorMessage
     */
    public deserialize(msg: Message | null): RabbitConnectorMessage {
        if (!msg) {
            return {error: "[NodeRabbitConnector] message was null."};
        } else {
            return <RabbitConnectorMessage> JSON.parse(msg.content.toString());
        }
    }

    /*
        acknowledges a rabbitmq message
     */
    public ack(msg: Message) {
        if (this.channel) {
            this.channel.ack(msg);
        } else {
            this.log("[NodeRabbitConnector] acknowledging message failed.", true);
        }
    }

    /*
        rejets a rabbitmq message
     */
    public reject(msg: Message) {
        if (this.channel) {
            this.channel.reject(msg);
        } else {
            this.log("[NodeRabbitConnector] rejecting message failed.", true);
        }
    }


}