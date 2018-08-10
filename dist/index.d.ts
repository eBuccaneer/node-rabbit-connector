/// <reference types="node" />
import { Message } from "amqplib";
import RabbitConnectorMessage from "./types/rabbitConnectorMessage";
import RabbitConnectorOptions from "./types/rabbitConnectorOptions";
export default class NodeRabbitConnector {
    private hostUrl;
    private reconnect;
    private reconnectInterval;
    private debug;
    private channelPrefetchCount;
    private connection?;
    private channel?;
    constructor(options?: RabbitConnectorOptions);
    connect(): Promise<void>;
    private connectChannel;
    setRPCListener(name: string, highPriority: boolean, consumerCallback: (msg: Message | null) => any): Promise<string>;
    replyToRPC(msg: RabbitConnectorMessage, highPriority: boolean): Promise<void>;
    sendRPC(name: string, msg: RabbitConnectorMessage, highPriority: boolean): Promise<RabbitConnectorMessage>;
    setWorkQueueListener(queueName: string, noAck: boolean, consumerCallback: (msg: Message | null) => any): Promise<string>;
    sendToWorkQueue(queueName: string, msg: RabbitConnectorMessage): Promise<undefined>;
    setTopicListener(exchange: string, key: string, durable: boolean, consumerCallback: (msg: Message | null) => any): Promise<string>;
    sendToTopic(exchange: string, key: string, msg: RabbitConnectorMessage, durable: boolean): Promise<undefined>;
    stopListening(consumerTag: string): Promise<undefined>;
    private log;
    serialize(msg: RabbitConnectorMessage): Buffer;
    deserialize(msg: Message | null): RabbitConnectorMessage;
    ack(msg: Message): void;
    reject(msg: Message): void;
}
