import cheerio from "cheerio";
import dotenv from "dotenv";
import Eris from "eris";
import he from "he";
import fetch from "node-fetch";
import truncate from "truncate";
import { URL } from "url";

import Metadata, { Urls } from "./metadata";

const HTML_BR_TAG_REGEX = /<br\s*[\\/]?>/gi;
const HTML_TAG_REGEX = /(<([^>]+)>)/gi;

const PIXIV_REGEX = /https?:\/\/(?:www\.|)pixiv\.net\/(?:en\/|)artworks\/(\d+)/g;
const PIXIV_ARTWORK_ENDPOINT = "https://www.pixiv.net/artworks/";
const PIXIV_USER_ENDPOINT = "https://www.pixiv.net/users/";
const PIXIV_PROXY_ENDPONT = "https://pixifull.xcvr48.workers.dev/";
const PIXIV_METADATA_SELECTOR = "#meta-preload-data";
const PIXIV_HEADERS = { Referer: "http://www.pixiv.net/" };
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
  return truncate(
    he.decode(description.replaceAll(HTML_BR_TAG_REGEX, "\n").replaceAll(HTML_TAG_REGEX, "")),
    DESCRIPTION_MAX_LENGTH,
    { ellipsis: " …" },
  );
}

async function findSuitableImage(urls: Urls): Promise<keyof Urls> {
  const response = await fetch(urls.original, { method: "HEAD", headers: PIXIV_HEADERS });
  if (!response.ok) {
    return "regular";
  }

  const length = response.headers.get("content-length");

  if (length && parseInt(length) > 10 * 1024 * 1024) {
    return "regular";
  }

  return "original";
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

  const imageQuality = await findSuitableImage(illust.urls);

  const embed: Eris.EmbedOptions = {
    color: 0x0096fa,
    title: illust.title,
    description: formatDescription(illust.description),
    url: PIXIV_ARTWORK_ENDPOINT + id,
    timestamp: illust.uploadDate,
    image: {
      url: getProxiedUrl(illust.urls[imageQuality]),
    },
    fields: [
      { name: "Views", value: illust.viewCount.toLocaleString(), inline: true },
      { name: "Bookmarks", value: illust.bookmarkCount.toLocaleString(), inline: true },
      { name: "Likes", value: illust.likeCount.toLocaleString(), inline: true },
      ...(imageQuality !== "original"
        ? [
            {
              name: "Image Quality",
              value: `Using ${imageQuality} due to size, [click here for original](${getProxiedUrl(
                illust.urls.original,
              )})`,
            },
          ]
        : []),
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
