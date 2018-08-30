export default interface RabbitConnectorOptions {
    reconnect?: boolean;
    reconnectInterval?: number;
    reconnectTries?: number;
    hostUrl?: string;
    channelPrefetchCount?: number;
    exitOnDisconnectError?: boolean;
    debug?: boolean | ((msg: string, isErr?: boolean, exit?: boolean) => void);
}
