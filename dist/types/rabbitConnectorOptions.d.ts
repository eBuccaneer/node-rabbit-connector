export default interface RabbitConnectorOptions {
    reconnect?: boolean;
    reconnectInterval?: number;
    hostUrl?: string;
    channelPrefetchCount?: number;
    debug?: boolean | Function;
}
