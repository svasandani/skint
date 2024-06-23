import { google } from "googleapis";
import { authorize } from "./calendar.js";

const run = async () => {
  const auth = await authorize();

  const title = process.argv.pop();

  if (!title) {
    throw new Error("Title is required");
  }

  console.log({
    msg: "Deleting events with given title",
    title,
  })

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