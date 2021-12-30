import { EmbedOptions } from "eris";
import mitt from "mitt";

export interface IMessage {
  guildId: string;
  channelId: string;
  messageId: string;
  userId: string;
  content: string;
}

export class Adapter {
  emitter = mitt<{
    message: IMessage;
  }>();

  constructor() {
    return this;
  }

  async removeEmbeds(guildID: string, channelID: string, messageID: string) {
    throw new Error("Method not implemented.");
  }

  sendEmbeds(guildID: string, channelID: string, messageID: string, embeds: EmbedOptions[]) {
    throw new Error("Method not implemented.");
  }
}
