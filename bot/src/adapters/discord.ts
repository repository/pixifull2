import Eris, { EmbedOptions } from "eris";

import { Adapter } from "./adapter";

export class DiscordAdapter extends Adapter {
  private client: Eris.Client;

  constructor(token: string) {
    super();
    this.client = new Eris.Client(token);
    this.client.on("messageCreate", (msg) => {
      if (msg.author.bot) return;
      this.emitter.emit("message", {
        guildId: msg.guildID!,
        channelId: msg.channel.id,
        messageId: msg.id,
        userId: msg.author.id,
        content: msg.content,
      });
    });
    this.client.connect();
  }

  async removeEmbeds(guildID: string, channelID: string, messageID: string) {
    await this.client.editMessage(channelID, messageID, { flags: 4 });
  }

  sendEmbeds(guildID: string, channelID: string, messageID: string, embeds: EmbedOptions[]) {
    let embedHidden = false;

    embeds.map((embed) =>
      Promise.all<any>([
        this.client.createMessage(channelID, {
          embed,
          messageReference: { messageID, failIfNotExists: true },
        }),
        ...(embedHidden ? [] : [this.removeEmbeds(guildID, channelID, messageID).then(() => (embedHidden = true))]),
      ]),
    );
  }
}
