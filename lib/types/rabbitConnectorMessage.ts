/*
    message to be sent by rabbitmq
 */
export default interface RabbitConnectorMessage {

    // message content
    msg?: string;

    // data content
    data?: any;

    // error key
    error?: string;

    // correlation ID for use with rpc calls
    corrId?: string;

    // response queue name for use with rpc calls
    replyTo?: string;

    // json web token for access control
    jwt?: string;
}