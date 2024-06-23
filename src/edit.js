import { google } from "googleapis";
import { authorize } from "./calendar.js";

const run = async () => {
  const auth = await authorize();

  let nextPageToken;
  let totalEvents = 0;
  
  do {
    const response = await google.calendar("v3").events.list(
      {
        auth,
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        pageToken: nextPageToken,
      }
    );

    const events = response?.data?.items ?? [];
        
    totalEvents += events.length;

    let current = 1;
    for (const event of events) {
      console.log(`${totalEvents - events.length + current++} / ${totalEvents}`);

      let char = event?.summary?.charAt(0) ?? "";
      /**
       * Only do this once.
       */
      if (!isNaN(parseInt(char))) char = event?.summary?.split(" ")?.[1]?.charAt(0) ?? "";
      const source = char === char.toLowerCase() ? { title: "the skint", url: "https://theskint.com/" } : { title: "Nonsense NYC", url: "https://nonsensenyc.com/" }

      await google.calendar("v3").events.patch(
        {
          auth,
          calendarId: process.env.GOOGLE_CALENDAR_ID,
          eventId: event.id,
          requestBody: {
            source,
          }
        }
      );
    }

    nextPageToken = response?.data?.nextPageToken;
  } while (nextPageToken);
  
  console.log({
    msg: "Edited events!",
  })
}

run();