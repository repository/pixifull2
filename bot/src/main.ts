Object.assign(global, { WebSocket: require("ws") });
require("fetch-register");
import fetch from "node-fetch";
// @ts-expect-error fetch does not exist in node by default
globalThis.fetch = fetch;

import dotenv from "dotenv";

import { Adapter } from "./adapters/adapter";
import { DiscordAdapter } from "./adapters/discord";
import { HarmonyAdapter } from "./adapters/harmony";
import { Parser } from "./parser";

const PIXIV_REGEX = /https?:\/\/(?:www\.|)pixiv\.net\/(?:en\/|)artworks\/(\d+)/g;

dotenv.config();

const parser = new Parser();

let adapter: Adapter;

if (process.env.HARMONY_URL && process.env.HARMONY_TOKEN) {
  adapter = new HarmonyAdapter(process.env.HARMONY_URL, process.env.HARMONY_TOKEN);
} else if (process.env.BOT_TOKEN) {
  adapter = new DiscordAdapter(process.env.BOT_TOKEN);
} else {
  console.log("BOT_TOKEN or HARMONY_URL and HARMONY_TOKEN are required.");
  process.exit(1);
}

adapter.emitter.on("message", async ({ content, guildId, channelId, messageId }) => {
  const ids = [...new Set([...content.matchAll(PIXIV_REGEX)].map((match) => match[1]))];
  if (ids.length < 1) return;

  adapter.sendEmbeds(
    guildId,
    channelId,
    messageId,
    await Promise.all<any>([
      ...ids.map((id) =>
        parser.generateEmbed(id).catch((error) => console.log(`failed to generate embed for id ${id}\n  ${error}`)),
      ),
    ]),
  );
});
