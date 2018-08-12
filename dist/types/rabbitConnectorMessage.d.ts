export default interface RabbitConnectorMessage {
    msg?: string;
    data?: any;
    error?: string;
    corrId?: string;
    replyTo?: string;
    jwt?: string;
}
