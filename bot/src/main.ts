import cheerio from "cheerio";
import dotenv from "dotenv";
import Eris from "eris";
import he from "he";
import fetch from "node-fetch";
import { URL } from "url";

import Metadata from "./metadata";

const HTML_BR_TAG_REGEX = /<br\s*[\\/]?>/gi;
const HTML_TAG_REGEX = /(<([^>]+)>)/gi;

const PIXIV_REGEX = /https?:\/\/(?:www\.|)pixiv\.net\/(?:en\/|)artworks\/(\d+)/g;
const PIXIV_ARTWORK_ENDPOINT = "https://www.pixiv.net/artworks/";
const PIXIV_USER_ENDPOINT = "https://www.pixiv.net/users/";
const PIXIV_PROXY_ENDPONT = "https://pixifull.xcvr48.workers.dev/";
const PIXIV_METADATA_SELECTOR = "#meta-preload-data";
const DESCRIPTION_MAX_LENGTH = 350;

dotenv.config();

if (!process.env.BOT_TOKEN) {
  console.error("BOT_TOKEN env variable is not set");
  process.exit(1);
}

const bot = new Eris.Client(process.env.BOT_TOKEN);

function getProxiedUrl(url: string) {
  return new URL(new URL(url).pathname, PIXIV_PROXY_ENDPONT).toString();
}

function formatDescription(description: string) {
  description = he.decode(description.replaceAll(HTML_BR_TAG_REGEX, "\n").replaceAll(HTML_TAG_REGEX, ""));

  let formatted = "";
  let overflow = false;
  const lines = description.split("\n");
  if (lines.length > 3) {
    for (const line of lines) {
      if ((formatted + line).length > DESCRIPTION_MAX_LENGTH) {
        overflow = true;
        break;
      } else {
        formatted += line + "\n";
      }

      if (formatted.split("\n").length < 3 && overflow) {
        formatted = "";
        for (const line of lines) {
          if ((formatted + line).length > DESCRIPTION_MAX_LENGTH - 3) {
            formatted += line.substr(0, DESCRIPTION_MAX_LENGTH - 3 - formatted.length);
            break;
          } else {
            formatted += line + "\n";
          }
        }
      }
    }
  } else if (description.length > DESCRIPTION_MAX_LENGTH) {
    formatted = description.substr(0, DESCRIPTION_MAX_LENGTH - 3);
    overflow = true;
  } else {
    return description;
  }

  return formatted;
}

async function generateEmbed(id: string) {
  const response = await fetch(PIXIV_ARTWORK_ENDPOINT + id);

  if (!response.ok) {
    throw new Error(response.status + " " + response.statusText);
  }

  const metadata: Metadata = JSON.parse(
    cheerio
      .load(await response.text())(PIXIV_METADATA_SELECTOR)
      .prop("content"),
  );

  const illust = metadata.illust[id] ?? Object.values(metadata.illust)[0];

  if (!illust) {
    throw new Error("couldn't find illust in metadata");
  }

  if (illust.xRestrict) {
    throw new Error("r-18");
  }

  const user = metadata.user[illust.userId];

  const embed: Eris.EmbedOptions = {
    color: 0x0096fa,
    title: illust.title,
    description: formatDescription(illust.description),
    url: PIXIV_ARTWORK_ENDPOINT + id,
    timestamp: illust.uploadDate,
    image: {
      url: getProxiedUrl(illust.urls.original),
    },
    fields: [
      { name: "Views", value: illust.viewCount.toLocaleString(), inline: true },
      { name: "Bookmarks", value: illust.bookmarkCount.toLocaleString(), inline: true },
      { name: "Likes", value: illust.likeCount.toLocaleString(), inline: true },
    ],
    ...(user && {
      author: {
        icon_url: getProxiedUrl(user.image),
        name: user.name,
        url: PIXIV_USER_ENDPOINT + user.userId,
      },
    }),
  };

  return embed;
}

bot.on("messageCreate", (message) => {
  if (message.author.bot) return;

  const ids = [...new Set([...message.content.matchAll(PIXIV_REGEX)].map((match) => match[1]))];

  if (ids.length < 1) return;

  let embedHidden = false;
  ids.map((id) =>
    generateEmbed(id)
      .then((embed) =>
        Promise.all<any>([
          bot.createMessage(message.channel.id, {
            embed,
            messageReference: { messageID: message.id, failIfNotExists: true },
          }),
          ...(embedHidden ? [] : [message.edit({ flags: 4 }).then(() => (embedHidden = true))]),
        ]),
      )
      .catch((error) => console.log(`failed to generate embed for id ${id}\n  ${error}`)),
  );
});

bot.on("ready", () => {
  console.log("bot ready");
});

bot.connect();
