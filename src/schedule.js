import { google } from "googleapis";
import { DateTime } from "luxon";

export class Event {
  /**
   *
   * @param {string} title
   * @param {string} [description]
   * @param {string} [location]
   * @param {DateTime} start
   * @param {DateTime} [end]
   * @param {boolean} [hasTime=false]
   * @param {object} [debug]
   */
  constructor(title, description, location, start, end, hasTime, source, debug) {
    this.title = title;
    this.description = description;
    this.location = location;
    this.start = start;
    this.end = end;
    this.hasTime = hasTime;
    this.source = source ?? null;
    this.debug = debug;
  }

  /**
   *
   * @param {google.auth.OAuth2} auth
   */
  async findMatchingCalendarEvent(auth) {
    const thisEvent = this;

    return new Promise((resolve, reject) => {
      google.calendar("v3").events.list(
        {
          auth,
          calendarId: process.env.GOOGLE_CALENDAR_ID,
          q: thisEvent.title,
        },
        function (err, response) {
          if (err) {
            console.error({
              msg: "Error connecting to Calendar API",
              err,
            });
            reject(err);
          }

          const events = response?.data?.items ?? [];

          resolve(
            events.find(
              (event) =>
                event.summary === thisEvent.title &&
                event.location === thisEvent.location &&
                (event.start.date === thisEvent.start.toISODate() ||
                  event.start.dateTime ===
                    thisEvent.start.toISO({ suppressMilliseconds: true })) &&
                (event.end.date === thisEvent.end.toISODate() ||
                  event.end.dateTime ===
                    thisEvent.end.toISO({ suppressMilliseconds: true }))
            )
          );
        }
      );
    });
  }

  /**
   *
   * @param {google.auth.OAuth2} auth
   */
  async createCalendarEvent(auth) {
    const thisEvent = this;

    return new Promise((resolve, reject) => {
      google.calendar("v3").events.insert(
        {
          auth,
          calendarId: process.env.GOOGLE_CALENDAR_ID,
          resource: {
            summary: thisEvent.title,
            location: thisEvent.location,
            description: thisEvent.description,
            source: thisEvent.source,
            start: thisEvent.hasTime
              ? {
                  dateTime: thisEvent.start.toISO({
                    suppressMilliseconds: true,
                  }),
                  timeZone: "America/New_York",
                }
              : {
                  date: thisEvent.start.toISODate(),
                  timeZone: "America/New_York",
                },
            end: thisEvent.hasTime
              ? {
                  dateTime: thisEvent.end.toISO({ suppressMilliseconds: true }),
                  timeZone: "America/New_York",
                }
              : {
                  date: thisEvent.end.toISODate(),
                  timeZone: "America/New_York",
                },
          },
        },
        function (err, response) {
          if (err || !response?.data) {
            console.error({
              msg: "Error connecting to Calendar API",
              err,
            });
            reject(err);
          }

          resolve(response.data);
        }
      );
    });
  }

  async logCalendarEvent() {
    console.info(this);
  }
}
