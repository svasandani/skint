import { DateTime } from "luxon";

import { Event } from "./schedule.js";

/**
 *
 * @param {string} timeString
 * @returns {{ startHour: number, startMinute: number, endHour?: number, endMinute?: number }}
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
    endPeriod = endString.includes("am") ? "am" : "pm";
  }
  if (startString) {
    startPeriod = startString.includes("am")
      ? "am"
      : startString.includes("pm")
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
    startHour:
      ((12 + parseInt(startHour)) % 12) +
      ((startPeriod ?? endPeriod) === "am" ? 0 : 12),
    startMinute: startMinute ? parseInt(startMinute) : 0,
  };

  if (endString) {
    response.endHour = parseInt(endHour) + (endPeriod === "am" ? 0 : 12);
    response.endMinute = endMinute ? parseInt(endMinute) : 0;
  }

  return response;
};

/**
 *
 * @param {string} dateString
 * @param {DateTime} relativeDate
 * @returns {{ startYear: number, startMonth: number, startDay: number, endYear: number, endMonth: number, endDay: number }}
 */
const parseDate = (dateString, relativeDate) => {
  if (!dateString) throw new Error("Expected value missing");

  let startString, endString;

  if (dateString.match(/^thru/)) {
    startString = `${relativeDate.month}/${relativeDate.day}`;
    endString = dateString.split("thru ")[1];
  } else if (dateString.includes(" thru ")) {
    [startString, endString] = dateString.split(" thru ");
  } else if (dateString.includes("-")) {
    [startString, endString] = dateString.split("-");
  } else {
    startString = dateString;
  }

  const dateType = startString.includes("/") ? "month_day" : "day_of_week";

  if (dateType === "month_day") {
    const [startMonth, startDay] = startString.split("/");

    const response = {
      startYear:
        relativeDate.year + (parseInt(startMonth) < relativeDate.month ? 1 : 0),
      startMonth: parseInt(startMonth),
      startDay: parseInt(startDay),
      endYear:
        relativeDate.year + (parseInt(startMonth) < relativeDate.month ? 1 : 0),
      endMonth: parseInt(startMonth),
      endDay: parseInt(startDay),
    };

    if (endString) {
      let endMonth, endDay;

      if (endString.includes("/")) {
        [endMonth, endDay] = endString.split("/");
      } else {
        endMonth = startMonth;
        endDay = endString;
      }

      response.endYear =
        relativeDate.year + (parseInt(endMonth) < relativeDate.month ? 1 : 0);
      response.endMonth = parseInt(endMonth);
      response.endDay = parseInt(endDay);
    }

    return response;
  } else if (dateType === "day_of_week") {
    const startDayOfWeek = DAYS_OF_WEEK.indexOf(startString) + 1;
    if (startDayOfWeek < 0) {
      throw new Error({ msg: "Unexpected day of week", dateString });
    }

    const dayDelta = (7 + startDayOfWeek - relativeDate.weekday) % 7;
    const startDate = relativeDate.plus({ days: dayDelta - 1 });

    const response = {
      startYear: startDate.year,
      startMonth: startDate.month,
      startDay: startDate.day,
      endYear: startDate.year,
      endMonth: startDate.month,
      endDay: startDate.day,
    };

    if (endString) {
      const endDayOfWeek = DAYS_OF_WEEK.indexOf(endString) + 1;
      if (endDayOfWeek < 0) {
        throw new Error({ msg: "Unexpected day of week", dateString });
      }

      const dayDelta = (7 + endDayOfWeek - relativeDate.weekday) % 7;
      const endDate = relativeDate.plus({ days: dayDelta - 1 });

      response.endYear = endDate.year;
      response.endMonth = endDate.month;
      response.endDay = endDate.day;
    }

    return response;
  }
};

/**
 * 
 * @param {string} dateString 
 * @param DateTime relativeDate 
 * @returns {{ startYear: number, startMonth: number, startDay: number, endYear: number, endMonth: number, endDay: number }[]}
 */
const parseDateAsRange = (dateString, relativeDate) => {
  if (!dateString) throw new Error("Expected value missing");

  if (dateString.match(" thru ")) {
    const [startRange, endRange] = dateString.split(" thru ");
    const [parsedStartDate] = parseDate(startRange, relativeDate);
    const startDate = DateTime.fromObject({
      year: parsedStartDate.startYear,
      month: parsedStartDate.startMonth,
      day: parsedStartDate.startDay,
    });
    const [parsedEndDate] = parseDate(endRange, relativeDate);
    const endDate = DateTime.fromObject({
      year: parsedEndDate.startYear,
      month: parsedEndDate.startMonth,
      day: parsedEndDate.startDay,
    })
    const delta = endDate.diff(startDate, "days").days;

    return new Array(delta + 1).fill(0).map((_, index) => {
      const date = startDate.plus({ days: index });

      return {
        startYear: date.year,
        startMonth: date.month,
        startDay: date.day,
        endYear: date.year,
        endMonth: date.month,
        endDay: date.day,
      };
    });
  } else if (dateString.includes("-")) {
    let [startRange, endRange] = dateString.split("-");
    const parsedStartDate = parseDate(startRange, relativeDate);
    const startDate = DateTime.fromObject({
      year: parsedStartDate.startYear,
      month: parsedStartDate.startMonth,
      day: parsedStartDate.startDay,
    });
    if (startRange.includes("/") && !endRange.includes("/")) {
      endRange = `${startRange.split("/")[0]}/${endRange}`;
    }
    const parsedEndDate = parseDate(endRange, relativeDate);
    const endDate = DateTime.fromObject({
      year: parsedEndDate.startYear,
      month: parsedEndDate.startMonth,
      day: parsedEndDate.startDay,
    })
    const delta = endDate.diff(startDate, "days").days;

    return new Array(delta + 1).fill(0).map((_, index) => {
      const date = startDate.plus({ days: index });

      return {
        startYear: date.year,
        startMonth: date.month,
        startDay: date.day,
        endYear: date.year,
        endMonth: date.month,
        endDay: date.day,
      };
    });
  } else {
    return [parseDate(dateString, relativeDate)];
  }
}

const DAYS_OF_WEEK = ["sun", "mon", "tues", "weds", "thurs", "fri", "sat"];
const DAY_OF_WEEK_REGEX = `(${DAYS_OF_WEEK.join("|")})((-| thru )${DAYS_OF_WEEK.join(
  "|"
)})?`;
const MONTH_DAY_REGEX = `\\d{1,2}/\\d{1,2}((-| thru )\\d{1,2}(/\\d{1,2})?)?`;
const DATE_REGEX = `(${DAY_OF_WEEK_REGEX}|${MONTH_DAY_REGEX})`;
const TIME_REGEX = "\\(?[\\d:]+?(am|pm)?(-[\\d:]+?)?(am|pm)\\)?";

const REGEXES = [
  {
    regex: new RegExp(`thru ${DATE_REGEX}(\\.|:| )`, "g"),
    getData: (match, relativeDate) => {
      const date = parseDate(match, relativeDate);

      return [
        {
          start: DateTime.fromObject({
            year: date.startYear,
            month: date.startMonth,
            day: date.startDay,
          }),
          end: DateTime.fromObject({
            year: date.endYear,
            month: date.endMonth,
            day: date.endDay,
          }),
          hasTime: false,
        },
      ];
    },
  },
  {
    regex: new RegExp(`${DATE_REGEX} ${TIME_REGEX} \\+ ${TIME_REGEX}`, "g"),
    getData: (match, relativeDate) => {
      const [dateAndFirstTimeString, secondTimeString] = match.split(" + ");
      const [dateString, firstTimeString] = dateAndFirstTimeString.split(/(?<! thru) (?!thru )/);

      const dates = parseDateAsRange(dateString, relativeDate);
      const firstTime = parseTime(firstTimeString);
      const secondTime = parseTime(secondTimeString);

      return dates.map((date) => [
        {
          start: DateTime.fromObject({
            year: date.startYear,
            month: date.startMonth,
            day: date.startDay,
            hour: firstTime.startHour,
            minute: firstTime.startMinute,
          }),
          end: DateTime.fromObject({
            year: date.endYear,
            month: date.endMonth,
            day: date.endDay,
            hour: firstTime?.endHour ?? firstTime.startHour,
            minute: firstTime?.endHour
              ? firstTime?.endMinute
              : firstTime.startMinute,
          }).plus(firstTime?.endHour ? {} : { hours: 1 }),
          hasTime: true,
        },
        {
          start: DateTime.fromObject({
            year: date.startYear,
            month: date.startMonth,
            day: date.startDay,
            hour: secondTime.startHour,
            minute: secondTime.startMinute,
          }),
          end: DateTime.fromObject({
            year: date.endYear,
            month: date.endMonth,
            day: date.endDay,
            hour: secondTime?.endHour ?? secondTime.startHour,
            minute: secondTime?.endHour
              ? secondTime?.endMinute
              : secondTime.startMinute,
          }).plus(secondTime?.endHour ? {} : { hours: 1 }),
          hasTime: true,
        },
      ]).flat();
    },
  },
  {
    regex: new RegExp(
      `${DATE_REGEX} \\+ ${DAY_OF_WEEK_REGEX}(\\.|:| ${TIME_REGEX})?`,
      "g"
    ),
    getData: (match, relativeDate) => {
      const [firstDateString, secondDateAndTimeString] = match.split(" + ");
      const [secondDateString, timeString] = secondDateAndTimeString.split(/(?<! thru) (?!thru )/);

      const time = timeString ? parseTime(timeString) : undefined;

      if (time) {
        const firstDates = parseDateAsRange(firstDateString, relativeDate);
        const secondDates = parseDateAsRange(secondDateString, relativeDate);
  
        return [...firstDates, ...secondDates].map((date) => ({
          start: DateTime.fromObject({
            year: date.startYear,
            month: date.startMonth,
            day: date.startDay,
            hour: time?.startHour,
            minute: time?.startMinute,
          }),
          end: DateTime.fromObject({
            year: date.endYear,
            month: date.endMonth,
            day: date.endDay,
            hour: time?.endHour ?? time?.startHour,
            minute: time?.endHour ? time?.endMinute : time?.startMinute,
          }).plus(time?.endHour ? {} : { hours: 1 }),
          hasTime: true,
        }));
      } else {
        const firstDate = parseDate(firstDateString, relativeDate);
        const secondDate = parseDate(secondDateString, relativeDate);
  
        return [
          {
            start: DateTime.fromObject({
              year: firstDate.startYear,
              month: firstDate.startMonth,
              day: firstDate.startDay,
              hour: time?.startHour,
              minute: time?.startMinute,
            }),
            end: DateTime.fromObject({
              year: firstDate.endYear,
              month: firstDate.endMonth,
              day: firstDate.endDay,
              hour: time?.endHour ?? time?.startHour,
              minute: time?.endHour ? time?.endMinute : time?.startMinute,
            }).plus(time?.endHour ? {} : { hours: 1 }),
            hasTime: false,
          },
          {
            start: DateTime.fromObject({
              year: secondDate.startYear,
              month: secondDate.startMonth,
              day: secondDate.startDay,
              hour: time?.startHour,
              minute: time?.startMinute,
            }),
            end: DateTime.fromObject({
              year: secondDate.endYear,
              month: secondDate.endMonth,
              day: secondDate.endDay,
              hour: time?.endHour ?? time?.startHour,
              minute: time?.endHour ? time?.endMinute : time?.startMinute,
            }).plus(time?.endHour ? {} : { hours: 1 }),
            hasTime: false,
          },
        ]
      }
    },
  },
  {
    regex: new RegExp(`${DATE_REGEX}(\\.|:| ${TIME_REGEX})`, "g"),
    getData: (match, relativeDate) => {
      const [dateString, timeString] = match.split(/(?<! thru) (?!thru )/);

      const time = timeString ? parseTime(timeString) : undefined;

      if (time) {
        const dates = parseDateAsRange(dateString, relativeDate);

        return dates.map((date) => ({
          start: DateTime.fromObject({
            year: date.startYear,
            month: date.startMonth,
            day: date.startDay,
            hour: time?.startHour,
            minute: time?.startMinute,
          }),
          end: DateTime.fromObject({
            year: date.endYear,
            month: date.endMonth,
            day: date.endDay,
            hour: time?.endHour ?? time?.startHour,
            minute: time?.endHour ? time?.endMinute : time?.startMinute,
          }).plus(time?.endHour ? {} : { hours: 1 }),
          hasTime: true,
        }));
      } else {
        const date = parseDate(dateString, relativeDate);

        return [{
          start: DateTime.fromObject({
            year: date.startYear,
            month: date.startMonth,
            day: date.startDay,
            hour: time?.startHour,
            minute: time?.startMinute,
          }),
          end: DateTime.fromObject({
            year: date.endYear,
            month: date.endMonth,
            day: date.endDay,
            hour: time?.endHour ?? time?.startHour,
            minute: time?.endHour ? time?.endMinute : time?.startMinute,
          }).plus(time?.endHour ? {} : { hours: 1 }),
          hasTime: false,
        }]
      }

      
    },
  },
];

/**
 * parseDate parses dates from a string.
 * @param {string} nodeText
 * @param {DateTime} relativeDate
 * @returns {{ start: DateTime, end: DateTime, hasTime: boolean }[]}
 */
const parseDateTime = (nodeText, relativeDate) => {
  for (const { regex, getData } of REGEXES) {
    const matches = nodeText.match(regex);

    if (matches && matches.length > 0) {
      return getData(matches[0], relativeDate);
    }
  }

  return [];
};

/**
 * parseNode parses a single `p` element.
 * @param {Element} node
 * @param {DateTime} relativeDate
 * @returns {Event[]}
 */
export const parseNode = (node, relativeDate) => {
  if (node.tagName !== "P") {
    console.error("Unexpected tag");
    return null;
  }

  const titleNode = node.querySelector("b");
  if (!titleNode) {
    console.error("No title node found");
    return null;
  }

  const nodeText = node.textContent;

  const location = nodeText.match(
    /(\. |\bto |\bat |: )\b(?<location>((?!\. |\bfeaturing\b|\bto\b|\bat\b|: ).)*?\b \([a-z ]*?\))/
  );
  const link = node.querySelector("a");
  const dateTimes = parseDateTime(nodeText, relativeDate);

  return dateTimes.map(({ start, end, hasTime }) => {
    if (!start) {
      console.error("No start found");
      return null;
    }

    return new Event(
      titleNode.textContent,
      nodeText + (link ? "\n\n" + link.href : ""),
      location?.groups?.location,
      start,
      end,
      hasTime
    );
  });
};

/**
 * parseNodes maps a node list into
 * @param {NodeListOf<Element>} nodes
 * @param {DateTime} relativeDate
 * @returns {Event[]}
 */
export const parseNodes = (nodes, relativeDate) => {
  const events = [];

  nodes.forEach((node) => {
    const event = parseNode(node, relativeDate);

    if (event) {
      events.push(...event);
    }
  });

  return events;
};
