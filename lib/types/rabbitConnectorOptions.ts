/*
    options object to configure the connector
 */
export default interface RabbitConnectorOptions {

    // if true, the the connector tries to connect to rabbitmq till the first connection is established
    reconnect?: boolean;

    // interval in milliseconds that indicates sleep time between connects
    reconnectInterval?: number;

    // maximum attempts to reconnect on start
    reconnectTries?: number;

    // the url for connecting to rabbitmq instance
    hostUrl?: string;

    // indicates the maximum number of unacknowledged messages per consumer
    channelPrefetchCount?: number;

    // indicates if process should be killed if disconnected
    exitOnDisconnectError?: boolean;

    // if truthy, debug output is printed to console
    // if given a function, it is called with (msg: string, isErr: boolean, exit?: boolean)
    debug?: boolean | ((msg: string, isErr?: boolean, exit?: boolean) => void);

    // callback that is called on close callback reception
    onClose?: () => void;

    // callback that is called if reconnection after receiving onClose event was successful
    onReconnected?: () => void;

    // callback that is called if reconnection after receiving onClose event was not possible
    onUnableToReconnect?: () => void;
}
