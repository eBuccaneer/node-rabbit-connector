import { Message } from "amqplib";
import RabbitConnectorMessage from "./types/rabbitConnectorMessage";
import RabbitConnectorOptions from "./types/rabbitConnectorOptions";
export default class NodeRabbitConnector {
    private workQueueListenerStorage;
    private rpcListenerStorage;
    private topicListenerStorage;
    private hostUrl;
    private reconnect;
    private reconnectTries;
    private reconnectCounter;
    private reconnectInterval;
    private exitOnDisconnectError;
    private debug;
    private onClose;
    private onReconnected;
    private onUnableToReconnect;
    private channelPrefetchCount;
    private connection?;
    private channel?;
    private recoveryInProgress;
    constructor(options?: RabbitConnectorOptions);
    connect(recovered?: boolean): Promise<void>;
    private connectChannel;
    private recover;
    private handleRecoveryAfterReconnection;
    setRPCListener(name: string, consumerCallback: (msg: Message | null) => any, highPriority?: boolean): Promise<string>;
    replyToRPC(msg: RabbitConnectorMessage): Promise<void>;
    sendRPC(name: string, msg: RabbitConnectorMessage, highPriority?: boolean): Promise<RabbitConnectorMessage>;
    setWorkQueueListener(queueName: string, noAck: boolean, consumerCallback: (msg: Message | null) => any): Promise<string>;
    sendToWorkQueue(queueName: string, msg: RabbitConnectorMessage): Promise<void>;
    setTopicListener(exchange: string, key: string, durable: boolean, consumerCallback: (msg: Message | null) => any): Promise<string>;
    sendToTopic(exchange: string, key: string, msg: RabbitConnectorMessage, durable: boolean): Promise<void>;
    stopListening(consumerTag: string): Promise<void>;
    private log;
    private serialize;
    deserialize(msg: Message | null): RabbitConnectorMessage;
    ack(msg: Message): void;
    reject(msg: Message): void;
    closeConnection(): Promise<void>;
}
