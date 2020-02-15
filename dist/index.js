"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const amqp = require("amqplib");
const uuid_1 = require("uuid");
const _get = require("lodash/get");
const _isFunction = require("lodash/isFunction");
/*
    simple interface for connecting to rabbitmq using amqplib (amqp in general, but only tested with rabbitmq)
 */
class NodeRabbitConnector {
    constructor(options = {}) {
        this.workQueueListenerStorage = [];
        this.rpcListenerStorage = [];
        this.topicListenerStorage = [];
        this.reconnectCounter = 0;
        this.onClose = () => { return; };
        this.onReconnected = () => { return; };
        this.onUnableToReconnect = () => { return; };
        this.recoveryInProgress = false;
        this.hostUrl = _get(options, "hostUrl", "amqp://localhost");
        this.reconnect = _get(options, "reconnect", true);
        this.reconnectInterval = _get(options, "reconnectInterval", 2000);
        if (_isFunction(options.debug)) {
            this.debug = options.debug;
        }
        else {
            this.debug = _get(options, "debug", false);
        }
        this.channelPrefetchCount = _get(options, "channelPrefetchCount", 1);
        this.reconnectTries = _get(options, "reconnectTries", 20);
        this.exitOnDisconnectError = _get(options, "exitOnDisconnectError", true);
        this.channel = undefined;
        this.connection = undefined;
        if (options.onClose && _isFunction(options.onClose)) {
            this.onClose = options.onClose;
        }
        if (options.onReconnected && _isFunction(options.onReconnected)) {
            this.onReconnected = options.onReconnected;
        }
        if (options.onUnableToReconnect && _isFunction(options.onUnableToReconnect)) {
            this.onUnableToReconnect = options.onUnableToReconnect;
        }
        if (!options && this.debug)
            this.log("[NodeRabbitConnector] No options given.");
    }
    /*
        connects the connector to rabbitmq, if successful a channel connection is established afterwards
     */
    connect(recovered = false) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.log(`[NodeRabbitConnector] connecting to host ${this.hostUrl} ...`);
                this.connection = yield amqp.connect(this.hostUrl);
                this.log(`[NodeRabbitConnector] connection to host ${this.hostUrl} established.`);
                yield this.connectChannel(recovered);
                return Promise.resolve();
            }
            catch (err) {
                this.log(`[NodeRabbitConnector] connecting to host ${this.hostUrl} failed.`, true);
                if (this.reconnect && this.reconnectCounter < this.reconnectTries) {
                    this.log(`[NodeRabbitConnector] reconnecting to host ${this.hostUrl} ...`);
                    this.reconnectCounter++;
                    const self = this;
                    yield new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                        setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                            try {
                                yield self.connect(recovered);
                                self.reconnectCounter = 0;
                                resolve();
                            }
                            catch (err) {
                                reject(err);
                            }
                        }), this.reconnectInterval);
                    }));
                }
                else {
                    return Promise.reject(err);
                }
            }
        });
    }
    /*
        connects a channel to the established connection
     */
    connectChannel(recovered = false) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!!this.connection) {
                    this.log("[NodeRabbitConnector] connecting to channel ...");
                    this.channel = yield this.connection.createChannel();
                    this.log("[NodeRabbitConnector] connected to channel. Setting prefetch count ...");
                    yield this.channel.prefetch(this.channelPrefetchCount, false);
                    this.log("[NodeRabbitConnector] prefetch count set. Ready to process some messages.");
                    this.channel.on("close", this.recover.bind(this));
                    if (recovered) {
                        yield this.handleRecoveryAfterReconnection();
                    }
                    return Promise.resolve();
                }
                else {
                    return Promise.reject(new Error(`[NodeRabbitConnector] connection is not established, 
                                                connecting to channel not possible.`));
                }
            }
            catch (err) {
                this.log("[NodeRabbitConnector] connecting to channel failed.", true);
                if (this.reconnect && this.reconnectCounter < this.reconnectTries) {
                    this.log("[NodeRabbitConnector] reconnecting to channel ...");
                    this.reconnectCounter++;
                    const self = this;
                    yield new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                        setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                            try {
                                yield self.connectChannel(recovered);
                                self.reconnectCounter = 0;
                                resolve();
                            }
                            catch (err) {
                                reject(err);
                            }
                        }), this.reconnectInterval);
                    }));
                }
                else {
                    return Promise.reject(err);
                }
            }
        });
    }
    recover() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.recoveryInProgress) {
                this.recoveryInProgress = true;
                try {
                    this.onClose();
                    yield this.connect(true);
                }
                catch (e) {
                    this.onUnableToReconnect();
                }
            }
        });
    }
    handleRecoveryAfterReconnection() {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: use pop() or something as this way its endless
            for (const workQueueListener of this.workQueueListenerStorage) {
                yield this.setWorkQueueListener(workQueueListener.queueName, workQueueListener.noAck, workQueueListener.consumerCallback);
            }
            for (const rpcListener of this.rpcListenerStorage) {
                yield this.setRPCListener(rpcListener.name, rpcListener.consumerCallback, rpcListener.highPriority);
            }
            for (const topicListener of this.topicListenerStorage) {
                yield this.setTopicListener(topicListener.exchange, topicListener.key, topicListener.durable, topicListener.callback);
            }
            this.onReconnected();
            this.recoveryInProgress = false;
        });
    }
    /*
        attaches an rpc consumer
     */
    setRPCListener(name, consumerCallback, highPriority) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!!this.channel) {
                    const self = this;
                    const wrapper = (msg) => {
                        self.log(`[NodeRabbitConnector] rpc request message received.`);
                        consumerCallback(msg);
                    };
                    this.log(`[NodeRabbitConnector] trying to listen to rpc ${name} ...`);
                    yield this.channel.assertQueue(name, { durable: true, maxPriority: highPriority ? 255 : 1 });
                    const response = yield this.channel.consume(name, wrapper, { noAck: false });
                    this.log(`[NodeRabbitConnector] listening to rpc ${name} ...`);
                    if (!this.recoveryInProgress) {
                        this.rpcListenerStorage.push({
                            name,
                            highPriority,
                            consumerCallback
                        });
                    }
                    return Promise.resolve(response.consumerTag);
                }
                else {
                    return Promise.reject(new Error(`[NodeRabbitConnector] channel not open so listening 
                                                to rpc ${name} not possible.`));
                }
            }
            catch (err) {
                this.log(`[NodeRabbitConnector] setting listener for rpc ${name} failed.`, true);
                return Promise.reject(err);
            }
        });
    }
    /*
        function to call by an rpc consumer after rpc work is done
     */
    replyToRPC(msg) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!!this.channel && msg.replyTo && msg.corrId) {
                    this.log(`[NodeRabbitConnector] trying to reply to rpc ${msg.replyTo} with corrId ${msg.corrId} ...`);
                    yield this.channel.sendToQueue(msg.replyTo, this.serialize(msg), { persistent: true });
                    this.log(`[NodeRabbitConnector] replied to rpc ${msg.replyTo} with corrId ${msg.corrId} ...`);
                    return Promise.resolve();
                }
                else {
                    return Promise.reject(new Error(`[NodeRabbitConnector] channel not open or corrId or replyTo properties
                                                not set so sending to rpc not possible.`));
                }
            }
            catch (err) {
                this.log(`[NodeRabbitConnector] replying rpc failed.`, true);
                return Promise.reject(err);
            }
        });
    }
    /*
        makes an rpc call, this can be answered by any consumer attached to the specific rpc call
     */
    sendRPC(name, msg, highPriority) {
        return __awaiter(this, void 0, void 0, function* () {
            const self = this;
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!!self.channel) {
                        self.log(`[NodeRabbitConnector] trying to send rpc ${name} ...`);
                        const assertedResponseQueue = yield self.channel.assertQueue("", { autoDelete: true, maxPriority: highPriority ? 255 : 1 });
                        const corrId = uuid_1.v4();
                        const replyTo = assertedResponseQueue.queue;
                        msg.replyTo = replyTo;
                        msg.corrId = corrId;
                        const responseConsumerTag = replyTo + name + corrId;
                        yield self.channel.consume(replyTo, (msg) => {
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
                            }
                            else {
                                self.log(`Message is ignored because corrId's are not matching.`);
                            }
                        }, { noAck: true, exclusive: true, consumerTag: responseConsumerTag });
                        yield self.channel.assertQueue(name, { durable: true, maxPriority: highPriority ? 255 : 1 });
                        yield self.channel.sendToQueue(name, self.serialize(msg), { persistent: true });
                        self.log(`[NodeRabbitConnector] sending rpc ${name} done.`);
                    }
                    else {
                        return reject(new Error(`[NodeRabbitConnector] channel not open so sending 
                                                rpc ${name} not possible.`));
                    }
                }
                catch (err) {
                    self.log(`[NodeRabbitConnector] sending rpc ${name} failed.`, true);
                    return reject(err);
                }
            }));
        });
    }
    /*
        attaches a work queue consumer
     */
    setWorkQueueListener(queueName, noAck, consumerCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!!this.channel) {
                    const self = this;
                    const wrapper = (msg) => {
                        self.log(`[NodeRabbitConnector] work queue request message received.`);
                        consumerCallback(msg);
                    };
                    this.log(`[NodeRabbitConnector] trying to listen to work queue ${queueName} ...`);
                    yield this.channel.assertQueue(queueName, { durable: true });
                    const response = yield this.channel.consume(queueName, wrapper, { noAck });
                    this.log(`[NodeRabbitConnector] listening to work queue ${queueName} ...`);
                    if (!this.recoveryInProgress) {
                        this.workQueueListenerStorage.push({
                            queueName,
                            noAck,
                            consumerCallback
                        });
                    }
                    return Promise.resolve(response.consumerTag);
                }
                else {
                    return Promise.reject(new Error(`[NodeRabbitConnector] channel not open so listening 
                                                to work queue ${queueName} not possible.`));
                }
            }
            catch (err) {
                this.log(`[NodeRabbitConnector] setting work queue listener for queue ${queueName} failed.`, true);
                return Promise.reject(err);
            }
        });
    }
    /*
        sends a message to a work queue, this will be received by only 1 consumer attached to the work queue
     */
    sendToWorkQueue(queueName, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!!this.channel) {
                    this.log(`[NodeRabbitConnector] trying to send to work queue ${queueName} ...`);
                    yield this.channel.assertQueue(queueName, { durable: true });
                    yield this.channel.sendToQueue(queueName, this.serialize(msg), { persistent: true });
                    this.log(`[NodeRabbitConnector] sending to work queue ${queueName} done.`);
                    return Promise.resolve();
                }
                else {
                    return Promise.reject(new Error(`[NodeRabbitConnector] channel not open so sending 
                                                to work queue ${queueName} not possible.`));
                }
            }
            catch (err) {
                this.log(`[NodeRabbitConnector] sending to work queue ${queueName} failed.`, true);
                return Promise.reject(err);
            }
        });
    }
    /*
        attaches a topic consumer
     */
    setTopicListener(exchange, key, durable, consumerCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!!this.channel) {
                    const self = this;
                    const wrapper = (msg) => {
                        self.log(`[NodeRabbitConnector] topic message received.`);
                        consumerCallback(msg);
                    };
                    this.log(`[NodeRabbitConnector] trying to listen to topic with key ${key} on exchange ${exchange} ...`);
                    yield this.channel.assertExchange(exchange, "topic", { durable });
                    const assertedQueue = yield this.channel.assertQueue("", { exclusive: true, durable });
                    yield this.channel.bindQueue(assertedQueue.queue, exchange, key);
                    const response = yield this.channel.consume(assertedQueue.queue, wrapper, { noAck: true });
                    this.log(`[NodeRabbitConnector] listening to topic with key ${key} on exchange ${exchange} ...`);
                    if (!this.recoveryInProgress) {
                        this.topicListenerStorage.push({
                            exchange,
                            key,
                            durable,
                            consumerCallback
                        });
                    }
                    return Promise.resolve(response.consumerTag);
                }
                else {
                    return Promise.reject(new Error(`[NodeRabbitConnector] channel not open so listening 
                                                to topic with key ${key} on exchange ${exchange} not possible.`));
                }
            }
            catch (err) {
                this.log(`[NodeRabbitConnector] setting topic listener with key ${key} 
                            on exchange ${exchange} failed.`, true);
                return Promise.reject(err);
            }
        });
    }
    /*
        sends a message to a specific topic, this will be received by all consumeres attached to this topic
     */
    sendToTopic(exchange, key, msg, durable) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!!this.channel) {
                    this.log(`[NodeRabbitConnector] trying to send to topic with key ${key} on exchange ${exchange} ...`);
                    yield this.channel.assertExchange(exchange, "topic", { durable });
                    yield this.channel.publish(exchange, key, this.serialize(msg));
                    this.log(`[NodeRabbitConnector] sending to topic with key ${key} on exchange ${exchange} done.`);
                    return Promise.resolve();
                }
                else {
                    return Promise.reject(new Error(`[NodeRabbitConnector] channel not open so sending 
                                                to topic with key ${key} on exchange ${exchange} not possible.`));
                }
            }
            catch (err) {
                this.log(`[NodeRabbitConnector] sending to topic with key ${key} on exchange ${exchange} failed.`, true);
                return Promise.reject(err);
            }
        });
    }
    /*
        stops listening by a specific consumer identified by @consumerTag
     */
    stopListening(consumerTag) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!!this.channel) {
                    this.log(`[NodeRabbitConnector] trying to cancel listener with consumer tag ${consumerTag} ...`);
                    yield this.channel.cancel(consumerTag);
                    this.log(`[NodeRabbitConnector] listener with consumer tag ${consumerTag} canceled.`);
                    return Promise.resolve();
                }
                else {
                    return Promise.reject(new Error(`[NodeRabbitConnector] channel not open so cancelling the listener 
                                                with consumer tag ${consumerTag} not possible.`));
                }
            }
            catch (err) {
                this.log(`[NodeRabbitConnector] cancelling the listener with consumer tag ${consumerTag} failed.`, true);
                return Promise.reject(err);
            }
        });
    }
    log(msg, isErr, exit) {
        if (this.debug) {
            if (_isFunction(this.debug)) {
                return this.debug(msg, isErr, exit);
            }
            else {
                if (isErr) {
                    console.error(msg);
                    if (exit && this.exitOnDisconnectError)
                        setTimeout(process.exit(1), 2000);
                }
                else {
                    console.log(msg);
                }
            }
        }
        else if (isErr) {
            console.error(msg);
            if (exit && this.exitOnDisconnectError)
                setTimeout(process.exit(1), 2000);
        }
    }
    serialize(msg) {
        return Buffer.from(JSON.stringify(msg));
    }
    /*
        deserializes a rabbitmq message to a RabbitConnectorMessage
     */
    deserialize(msg) {
        if (!msg) {
            return { error: "[NodeRabbitConnector] message was null." };
        }
        else {
            return JSON.parse(msg.content.toString());
        }
    }
    /*
        acknowledges a rabbitmq message
     */
    ack(msg) {
        if (this.channel) {
            this.channel.ack(msg);
        }
        else {
            this.log("[NodeRabbitConnector] acknowledging message failed.", true);
        }
    }
    /*
        rejets a rabbitmq message
     */
    reject(msg) {
        if (this.channel) {
            this.channel.reject(msg);
        }
        else {
            this.log("[NodeRabbitConnector] rejecting message failed.", true);
        }
    }
    /*
        closes the connection
     */
    closeConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.connection) {
                    yield this.connection.close();
                }
                else {
                    this.log("[NodeRabbitConnector] no open connection.", true);
                }
            }
            catch (err) {
                this.log("[NodeRabbitConnector] closing connection failed.", true);
            }
        });
    }
}
exports.default = NodeRabbitConnector;
