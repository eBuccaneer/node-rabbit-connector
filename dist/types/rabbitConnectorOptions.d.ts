export default interface RabbitConnectorOptions {
    reconnect?: boolean;
    reconnectInterval?: number;
    exitOnError?: boolean;
    hostUrl?: string;
    channelPrefetchCount?: number;
}
