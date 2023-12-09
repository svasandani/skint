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

  async createCalendarEvent() {
    console.log(JSON.stringify(this));
  }
}