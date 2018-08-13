/*
    options object to configure the connector
 */
export default interface RabbitConnectorOptions {

    // if true, the the connector tries to connect to rabbitmq till the first connection is established
    reconnect?: boolean;

    // interval in milliseconds that indicates sleep time between connects
    reconnectInterval?: number;

    // the url for connecting to rabbitmq instance
    hostUrl?: string;

    // indicates the maximum number of unacknowledged messages per consumer
    channelPrefetchCount?: number;

    // if true, debug output is printed to console
    debug?: boolean;
}