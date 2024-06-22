import { DateTime } from "luxon";

import { Event } from "./schedule.js";

/**
 *
 * @param {string} timeString
 * @returns {{ carryDay: boolean, startHour: number, startMinute: number, endHour?: number, endMinute?: number }}
 */
const parseTime = (timeStringUnescaped) => {
  if (!timeStringUnescaped) throw new Error("Expected value missing");

  const timeString = timeStringUnescaped.replace(/[\(\)]/g, "");

  let startString, endString;

  if (timeString.includes("-")) {
    [startString, endString] = timeString.split("-");
  } else {
    startString = timeString;
  }

  let startPeriod, endPeriod;

  if (endString) {
    endPeriod = endString.includes("a") ? "am" : "pm";
  }
  if (startString) {
    startPeriod = startString.includes("a")
      ? "am"
      : startString.includes("p")
      ? "pm"
      : undefined;
  }

  let startHour, startMinute;

  if (startString.includes(":")) {
    [startHour, startMinute] = startString.split(":");
  } else {
    startHour = startString;
  }

  let endHour, endMinute;

  if (endString?.includes(":")) {
    [endHour, endMinute] = endString.split(":");
  } else {
    endHour = endString;
  }

  const response = {
    carryDay: false,
    startHour:
      ((12 + parseInt(startHour)) % 12) +
      ((startPeriod ?? endPeriod) === "am" ? 0 : 12),
    startMinute: startMinute ? parseInt(startMinute) : 0,
  };

  if (endString) {
    response.endHour = ((12 + parseInt(endHour)) % 12) + (endPeriod === "am" ? 0 : 12);
    response.endMinute = endMinute ? parseInt(endMinute) : 0;
    response.carryDay = response.endHour < response.startHour || (response.endHour === response.startHour && response.endMinute < response.startMinute);
  }

  return response;
};

/**
 *
 * @param {string} dayOfWeek
 * @param {DateTime} relativeDate
 * @param {number} weekIncrement
 * @returns {{ start: DateTime, end: DateTime }}
 */
const parseDate = (dayOfWeek, relativeDate, weekIncrement) => {
  const startDayOfWeek = DAYS_OF_WEEK.indexOf(dayOfWeek) + 1;
  if (startDayOfWeek < 0) {
    throw new Error({ msg: "Unexpected day of week", dateString });
  }

  const dayDelta = (7 + startDayOfWeek - relativeDate.weekday) % 7;
  const startDate = relativeDate
    .plus({ days: dayDelta })
    .plus({ weeks: weekIncrement })
    .set({ hour: 12, minute: 0 });
  const endDate = startDate;

  return {
    start: startDate,
    end: endDate,
  };
};

const DAYS_OF_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];
const TIME_REGEX = "[\\d:]+?(a|p)?(-[\\d:]+?)?(a|p)";

/**
 * parseDate parses dates from a string.
 * @param {string} dayOfWeek
 * @param {string[]} potentialTimes
 * @param {DateTime} relativeDate
 * @param {number} weekIncrement
 * @returns {{ start: DateTime, end: DateTime, hasTime: boolean }[]}
 */
const parseDateTime = (dayOfWeek, potentialTimes, relativeDate, weekIncrement) => {
  const matches = potentialTimes.join("\n").match(new RegExp(
    TIME_REGEX,
    "g"
  ));

  if (matches && matches.length > 0) {
    return matches.map(timeString => {
      const time = parseTime(timeString);
      const { start, end } = parseDate(dayOfWeek, relativeDate, weekIncrement);

      return {
        start: start.set({
          hour: time.startHour,
          minute: time.startMinute,
        }),
        end: end
          .set({
            hour: time.endHour ?? time.startHour,
            minute: typeof time.endHour !== "undefined" ? time.endMinute : time.startMinute,
          })
          .plus(typeof time.endHour !== "undefined" ? {} : { hours: 1 })
          .plus(time.carryDay ? { days: 1 } : {}),
        hasTime: true,
      };
    });
  } else {
    const { start, end } = parseDate(dayOfWeek, relativeDate, weekIncrement);

    return [
      {
        start,
        end: end.plus({ days: 1 }),
        hasTime: false,
      },
    ];
  }
};

/**
 * parseNode parses a single `p` element.
 * @param {string[]} node
 * @param {DateTime} relativeDate
 * @param {number} weekIncrement
 * @returns {Event[]}
 */
export const parseNode = (node, relativeDate, weekIncrement) => {
  if (node.length < 3) {
    console.error({
      msg: "Unsure how to handle nodes of length less than 3",
      node,
    });
  }

  const dateString = node[0];
  const title = node[1];
  const locationAndTime = node[node.length - 1];

  const dayOfWeek = DAYS_OF_WEEK.find(dayOfWeek => dateString.toLowerCase().includes(dayOfWeek.toLowerCase()))
  if (!dayOfWeek) {
    console.error({
      msg: "Node does not have valid date string",
      dateString,
    });
    return null;
  }

  const nodeText = node.join("\n\n");

  const potentialTimes = [];
  let location = "";
  let stopCollectingLocation = false;
  for (const line of locationAndTime.split("\n")) {
    if (line.includes(";")) potentialTimes.push(line);
    if (line.includes("$")) stopCollectingLocation = true;

    if (!stopCollectingLocation) {
      location += line + "\n";
    }
  }
  const dateTimes = parseDateTime(dayOfWeek, potentialTimes, relativeDate, weekIncrement);

  return dateTimes.map(({ start, end, hasTime, debug }) => {
    if (!start) {
      console.error({
        msg: "No start date/time found",
        textContent: node.textContent,
        start,
        end,
        hasTime,
        debug,
      });
      return null;
    }

    return new Event(
      title,
      nodeText,
      location,
      start,
      end,
      hasTime,
      { title: "Nonsense NYC", url: "https://nonsensenyc.com/" },
      { ...debug, locationMatches: location }
    );
  });
};

/**
 * parseNodes maps a node list into
 * @param {string[][]} nodes
 * @param {DateTime} relativeDate
 * @returns {Event[]}
 */
export const parseNodes = (nodes, relativeDate) => {
  const events = [];

  let firstDayOfWeekSeen;
  let hasSeenDifferentDay = false;
  let weekIncrement = 0;

  nodes.forEach((node) => {
    const currentDayOfWeek = DAYS_OF_WEEK.find(dayOfWeek => node[0].toLowerCase().includes(dayOfWeek.toLowerCase()))
    if (currentDayOfWeek) {
      if (!firstDayOfWeekSeen) firstDayOfWeekSeen = currentDayOfWeek;
      else {
        if (currentDayOfWeek === firstDayOfWeekSeen && hasSeenDifferentDay) {
          hasSeenDifferentDay = false;
          weekIncrement++;
        } else if (currentDayOfWeek !== firstDayOfWeekSeen && !hasSeenDifferentDay) {
          hasSeenDifferentDay = true;
        }
      }
    }

    if (node[0].toLowerCase().includes(" upcoming ")) {
      firstDayOfWeekSeen = undefined;
      hasSeenDifferentDay = false;
      weekIncrement = 0;
    }

    const event = parseNode(node, relativeDate, weekIncrement);

    if (event) {
      events.push(...event);
    }
  });

  return events;
};
