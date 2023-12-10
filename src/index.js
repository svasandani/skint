import { JSDOM } from "jsdom";
import { DateTime } from "luxon";
import fetch from "node-fetch";

import { authorize } from "./calendar.js";
import { parseNodes } from "./parse.js";

const URL = "https://theskint.com/rss";

const main = async () => {
  const guid = process.argv.pop();

  if (!guid || Number.isNaN(parseInt(guid))) {
    throw new Error("Invalid GUID, should be number!");
  }

  const auth = await authorize();

  const response = await fetch(URL);
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

      const parsedEvents = parseNodes(
        pNodes,
        DateTime.fromJSDate(new Date(xmlPubDate.textContent))
      );

      for (const event of parsedEvents) {
        process.env.LIVE === "true"
          ? await event.createCalendarEvent(auth)
          : await event.logCalendarEvent();
      }
    }
  }
};

main();
