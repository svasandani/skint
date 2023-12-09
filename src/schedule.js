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
   */
  constructor(title, description, location, start, end, hasTime) {
    this.title = title;
    this.description = description;
    this.location = location;
    this.start = start;
    this.end = end;
    this.hasTime = hasTime;
  }

  /**
   * 
   * @param {google.auth.OAuth2} auth 
   */
  async createCalendarEvent(auth) {
    await new Promise((resolve, reject) => {
      google.calendar("v3").events.insert({
        auth,
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        resource: {
          "summary": this.title,
          "location": this.location,
          "description": this.description,
          "start": this.hasTime ? {
            "dateTime": this.start.toISO(),
            "timeZone": "America/New_York",
          } : {
            "date": this.start.toISODate(),
            "timeZone": "America/New_York",
          },
          "end": this.hasTime ? {
            "dateTime": this.end.toISO(),
            "timeZone": "America/New_York",
          } : {
            "date": this.end.toISODate(),
            "timeZone": "America/New_York",
          },
          "reminders": {
            "useDefault": true,
          },
        },
      }, function(err, event) {
        if (err) {
          console.error("There was an error contacting the Calendar service: " + err);
          reject(err);
        }
        resolve(event);
      });
    })
  }

  async logCalendarEvent() {
    console.log(JSON.stringify(this));
  }
}