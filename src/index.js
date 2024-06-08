import { readFile, stat } from "fs/promises";
import { JSDOM } from "jsdom";
import { DateTime } from "luxon";
import fetch from "node-fetch";

import { authorize } from "./calendar.js";
import { parseNodes } from "./parseSkint.js";
import { parseNodes as parseNonsenseNodes } from "./parseNonsense.js";

const RSS_URL = "https://theskint.com/rss";
const HTTP_URL = "https://theskint.com/?p=";

const main = async () => {
  const guid = process.argv.pop();
  const mode = process.env.MODE ?? "RSS";
  const relativeDate = process.env.DATE;
  const auth = await authorize();

  if (mode !== "RSS" && mode !== "HTTP" && mode !== "NONSENSE") {
    throw new Error("Unrecognized MODE, should be RSS, HTTP, or NONSENSE");
  }

  let parsedEvents = [];
  if (mode === "RSS") {
    /**
     * LIVE=true npm run parse 73170 > output.log
     */
    
    if (!guid || Number.isNaN(parseInt(guid))) {
      throw new Error("Invalid GUID, should be number!");
    }

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
          DateTime.fromJSDate(new Date(xmlPubDate.textContent)).set({ second: 0, millisecond: 0 })
        );
      }
    }
  } else if (mode === "HTTP") {
    if (!guid || Number.isNaN(parseInt(guid))) {
      throw new Error("Invalid GUID, should be number!");
    }

    if (!relativeDate) {
      throw new Error("Mode HTTP requires DATE to be set");
    }

    const response = await fetch(HTTP_URL + guid);
    const text = await response.text();

    const htmlDom = new JSDOM(text);

    const pNodes = htmlDom.window.document.body.querySelectorAll(
      `#post-${guid} > div > p`
    );

    parsedEvents = parseNodes(
      pNodes,
      DateTime.fromJSDate(new Date(relativeDate)).set({ second: 0, millisecond: 0 })
    );
  } else if (mode === "NONSENSE") {
    /**
     * LIVE=true DATE='06/07/2024' MODE=NONSENSE npm run parse > output.log
     */

    if (!relativeDate) {
      throw new Error("Mode NONSENSE requires DATE to be set");
    }

    if (!(await stat("nonsense.txt")).isFile) {
      throw new Error("Mode NONSENSE requires nonsense.txt file to exist");
    }

    let currentNode = -1;
    const nodes = [];
    const lines = (await readFile("nonsense.txt")).toString().split(/\n\s*\n+/g);

    for (const line of lines) {
      if (line.startsWith("XXXXX") || line.startsWith("*****")) currentNode++;
      if (currentNode >= 0) {
        if (!nodes[currentNode]) nodes[currentNode] = [];
        if (line.trim()) nodes[currentNode].push(line.trim());
      }
    }

    parsedEvents = parseNonsenseNodes(
      nodes,
      DateTime.fromJSDate(new Date(relativeDate)).set({ second: 0, millisecond: 0 })
    );
  }

  const responses = await Promise.allSettled(
    parsedEvents.map(async (event) => {
      console.info({
        msg: "Processing event",
        event,
      });

      if (process.env.LIVE === "true") {
        const existingEvent = await event.findMatchingCalendarEvent(auth);
        if (existingEvent) {
          console.info({
            msg: "Event already exists",
            existingEvent,
          });
          return false;
        } else {
          console.info({
            msg: "Event doesn't exist, creating",
            event,
          });
          const createdEvent = await event.createCalendarEvent(auth);
          console.info({
            msg: "Created event",
            createdEvent,
          });
          return true;
        }
      } else {
        await event.logCalendarEvent();
        return false;
      }
    })
  );

  console.info({
    msg: "Done creating events",
    createdEvents: responses.filter(({ value: eventCreated }) => eventCreated)
      .length,
  });
};

main();
