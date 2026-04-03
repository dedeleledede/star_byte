import type { FastifyBaseLogger } from "fastify";

export interface BridgeMessage {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface IrcBridge {
  publishMessage(message: BridgeMessage): Promise<void>;
}

export class NoopIrcBridge implements IrcBridge {
  constructor(private readonly log: FastifyBaseLogger) {}

  async publishMessage(message: BridgeMessage) {
    this.log.info({ message }, "irc bridge stub received message");
  }
}
