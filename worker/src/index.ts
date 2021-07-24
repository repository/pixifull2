async function handleRequest(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);

  const pixivUrl = new URL(pathname, "https://i.pximg.net/").toString();

  const res = await fetch(pixivUrl, { headers: { Referer: "http://www.pixiv.net/" } });
  const { writable, readable } = new TransformStream();
  res.body?.pipeTo(writable);

  return new Response(readable, res);
}

addEventListener("fetch", (event) => event.respondWith(handleRequest(event.request)));
