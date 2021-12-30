import { Connection } from "@harmony-dev/harmony-web-sdk";
import { Embed } from "@harmony-dev/harmony-web-sdk/dist/gen/chat/v1/messages";
import { EmbedOptions } from "eris";

import { Adapter } from "./adapter";

export class HarmonyAdapter extends Adapter {
  private client: Connection;

  constructor(host: string, token: string) {
    super();
    this.client = new Connection(host);
    this.client.setSession(token);
    const stream = this.client.chat.streamEvents();
    stream.responses.onMessage(({ event }) => {
      if (event.oneofKind === "chat" && event.chat.event.oneofKind === "sentMessage") {
        const msg = event.chat.event.sentMessage;
        if (msg.message?.content?.content.oneofKind !== "textMessage") return;
        const textContent = msg.message?.content?.content.textMessage.content?.text;
        if (!textContent || !msg.guildId || !msg.message) return;
        this.emitter.emit("message", {
          guildId: msg.guildId,
          channelId: msg.channelId,
          messageId: msg.messageId,
          userId: msg.message.authorId,
          content: textContent,
        });
      }
    });
    this.client.chat.getGuildList({}).then((guilds) =>
      guilds.response.guilds.forEach((guild) => {
        stream.requests.send({
          request: {
            oneofKind: "subscribeToGuild",
            subscribeToGuild: {
              guildId: guild.guildId,
            },
          },
        });
      }),
    );
  }

  async removeEmbeds(guildID: string, channelID: string, messageID: string) {
    // TODO: Implement when harmony embeds are fleshed out more
    // NOOP: Harmony embeds are not supported
  }

  sendEmbeds(guildId: string, channelId: string, messageId: string, embeds: EmbedOptions[]) {
    const embedHidden = false;

    this.client.chat.sendMessage({
      guildId,
      channelId,
      content: {
        content: {
          oneofKind: "embedMessage",
          embedMessage: {
            embeds: embeds.map((embed) => this.toHarmonyEmbed(embed)),
          },
        },
      },
    });
  }

  toHarmonyEmbed(embed: EmbedOptions): Embed {
    return Embed.create({
      title: embed.title,
      fields: [{ imageUrl: embed.image?.url }],
    });
  }
}
