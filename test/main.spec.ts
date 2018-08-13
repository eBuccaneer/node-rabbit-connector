// TODO: create some tests

import { expect } from "chai";
import "mocha";
import NodeRabbitConnector from "../lib/index";

describe("Basic tests", () => {

    it("should simply pass", async () => {
        const result = "test";
        expect(result).to.equal("test");
    });

    it("should create NodeRabbitConnector object with default values", async () => {
        const connector: NodeRabbitConnector = new NodeRabbitConnector();
        expect(NodeRabbitConnector).to.exist;
        expect(connector instanceof NodeRabbitConnector).to.be.true;
    });

});
