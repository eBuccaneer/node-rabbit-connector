import * as amqp from "amqplib";
import RabbitConnectorOptions from "./types/rabbitConnectorOptions";
const _get = require("lodash/get");

export default class NodeRabbitConnector{

    hostUrl: string;
    reconnect: boolean;
    reconnectInterval: number;
    debug: boolean;
    connection?: amqp.Connection;
    channel?: amqp.Channel;

    constructor(options: RabbitConnectorOptions = {}) {
        this.hostUrl = <string> _get(options, "hostUrl", "amqp://localhost");
        this.reconnect = <boolean>_get(options, "reconnect", true);
        this.reconnectInterval = <number> _get(options, "reconnectInterval", 2000);
        this.debug = <boolean> _get(options, "debug", false);
        this.channel = undefined;
        this.connection = undefined;

        if (!options) console.log("No options given");
    }

    public async connect() {
        // TODO: implement
        return Promise.resolve();
    }


}