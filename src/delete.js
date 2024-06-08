import { google } from "googleapis";
import { authorize } from "./calendar.js";

const title = `extended hours on the high line`;

const run = async () => {
  const auth = await authorize();

  google.calendar("v3").events.list(
    {
      auth,
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      q: title,
    },
    async function (err, response) {
      if (err) {
        console.error({
          msg: "Error connecting to Calendar API",
          err,
        });
        reject(err);
      }
  
      const events = response?.data?.items ?? [];
      const matchingEvents = events.filter(event => event.summary === title);

      let current = 1;
      for (const event of matchingEvents) {
        google.calendar("v3").events.delete(
          {
            auth,
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            eventId: event.id,
          }
        );

        console.log(`${current++} / ${matchingEvents.length}`);

        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  )
}

run();