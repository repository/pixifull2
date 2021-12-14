import cheerio from "cheerio";
import Eris from "eris";
import he from "he";
import fetch from "node-fetch";
import Metadata, { Urls } from "src/metadata";
import truncate from "truncate";
import { URL } from "url";

export class Parser {
  constructor(
    public HTML_BR_TAG_REGEX = /<br\s*[\\/]?>/gi,
    public HTML_TAG_REGEX = /(<([^>]+)>)/gi,
    public PIXIV_REGEX = /https?:\/\/(?:www\.|)pixiv\.net\/(?:en\/|)artworks\/(\d+)/g,
    public PIXIV_ARTWORK_ENDPOINT = "https://www.pixiv.net/artworks/",
    public PIXIV_USER_ENDPOINT = "https://www.pixiv.net/users/",
    public PIXIV_PROXY_ENDPONT = "https://pixifull.xcvr48.workers.dev/",
    public PIXIV_METADATA_SELECTOR = "#meta-preload-data",
    public PIXIV_HEADERS = { Referer: "http://www.pixiv.net/" },
    public DESCRIPTION_MAX_LENGTH = 350,
  ) {}

  async generateEmbed(id: string) {
    const response = await fetch(this.PIXIV_ARTWORK_ENDPOINT + id);

    if (!response.ok) {
      throw new Error(response.status + " " + response.statusText);
    }

    const metadata: Metadata = JSON.parse(
      cheerio
        .load(await response.text())(this.PIXIV_METADATA_SELECTOR)
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

    const imageQuality = await this.findSuitableImage(illust.urls);

    const embed: Eris.EmbedOptions = {
      color: 0x0096fa,
      title: illust.title,
      description: this.formatDescription(illust.description),
      url: this.PIXIV_ARTWORK_ENDPOINT + id,
      timestamp: illust.uploadDate,
      image: {
        url: this.getProxiedUrl(illust.urls[imageQuality]),
      },
      fields: [
        { name: "Views", value: illust.viewCount.toLocaleString(), inline: true },
        { name: "Bookmarks", value: illust.bookmarkCount.toLocaleString(), inline: true },
        { name: "Likes", value: illust.likeCount.toLocaleString(), inline: true },
        ...(imageQuality !== "original"
          ? [
              {
                name: "Image Quality",
                value: `Using ${imageQuality} due to size, [click here for original](${this.getProxiedUrl(
                  illust.urls.original,
                )})`,
              },
            ]
          : []),
      ],
      ...(user && {
        author: {
          icon_url: this.getProxiedUrl(user.image),
          name: user.name,
          url: this.PIXIV_USER_ENDPOINT + user.userId,
        },
      }),
    };

    return embed;
  }

  getProxiedUrl(url: string) {
    return new URL(new URL(url).pathname, this.PIXIV_PROXY_ENDPONT).toString();
  }

  formatDescription(description: string) {
    return truncate(
      he.decode(description.replaceAll(this.HTML_BR_TAG_REGEX, "\n").replaceAll(this.HTML_TAG_REGEX, "")),
      this.DESCRIPTION_MAX_LENGTH,
      { ellipsis: " …" },
    );
  }

  async findSuitableImage(urls: Urls): Promise<keyof Urls> {
    const response = await fetch(urls.original, { method: "HEAD", headers: this.PIXIV_HEADERS });
    if (!response.ok) {
      return "regular";
    }

    const length = response.headers.get("content-length");

    if (length && parseInt(length) > 10 * 1024 * 1024) {
      return "regular";
    }

    return "original";
  }
}
