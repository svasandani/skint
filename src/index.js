import { JSDOM } from "jsdom";
import { DateTime } from "luxon";
import fetch from "node-fetch";

import { authorize } from "./calendar.js";
import { parseNodes } from "./parse.js";

const RSS_URL = "https://theskint.com/rss";
const HTTP_URL = "https://theskint.com/?p=";

const main = async () => {
  const guid = process.argv.pop();

  if (!guid || Number.isNaN(parseInt(guid))) {
    throw new Error("Invalid GUID, should be number!");
  }

  const mode = process.env.MODE ?? "RSS";
  const relativeDate = process.env.DATE;

  if (mode !== "RSS" && mode !== "HTTP") {
    throw new Error("Unrecognized MODE, should be RSS or HTTP");
  }

  if (mode === "HTTP" && !relativeDate) {
    throw new Error("Mode HTTP requires DATE to be set");
  }

  const auth = await authorize();

  let parsedEvents = [];
  if (mode === "RSS") {
    const response = await fetch(RSS_URL);
    const text = await response.text();

    const shadowDom = new JSDOM("");
    const parser = new shadowDom.window.DOMParser();
    const xmlDom = parser.parseFromString(text, "text/xml");

    const xmlItems = xmlDom.querySelectorAll("item");

    for (const item of xmlItems) {
      const xmlContent = item.getElementsByTagName("content:encoded");
      const xmlGuid = item.querySelector("guid");
      const xmlPubDate = item.querySelector("pubDate");

      if (
        xmlContent[0] &&
        xmlGuid &&
        xmlGuid.textContent.includes(guid) &&
        xmlPubDate
      ) {
        const contentDom = new JSDOM(xmlContent[0].textContent);
        const pNodes = contentDom.window.document.body.querySelectorAll("p");

        parsedEvents = parseNodes(
          pNodes,
          DateTime.fromJSDate(new Date(xmlPubDate.textContent))
        );
      }
    }
  } else if (mode === "HTTP") {
    const response = await fetch(HTTP_URL + guid);
    const text = await response.text();

    const htmlDom = new JSDOM(text);

    const pNodes = htmlDom.window.document.body.querySelectorAll(
      `#post-${guid} > div > p`
    );

    parsedEvents = parseNodes(
      pNodes,
      DateTime.fromJSDate(new Date(relativeDate))
    );
  }

  for (const event of parsedEvents) {
    process.env.LIVE === "true"
      ? await event.createCalendarEvent(auth)
      : await event.logCalendarEvent();
  }
};

main();
