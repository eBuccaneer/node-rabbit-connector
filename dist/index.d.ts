import * as amqp from "amqplib";
import RabbitConnectorOptions from "./types/rabbitConnectorOptions";
export default class NodeRabbitConnector {
    hostUrl: string;
    reconnect: boolean;
    reconnectInterval: number;
    debug: boolean;
    connection?: amqp.Connection;
    channel?: amqp.Channel;
    constructor(options?: RabbitConnectorOptions);
    connect(): Promise<void>;
}
