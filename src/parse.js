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
 * @param {string} dateString
 * @param {DateTime} relativeDate
 * @returns {{ start: DateTime, end: DateTime }}
 */
const parseDate = (dateString, relativeDate) => {
  if (!dateString) throw new Error("Expected value missing");

  let startString, endString;

  if (dateString.match(/^thru/)) {
    startString = DAYS_OF_WEEK[relativeDate.weekday];
    endString = dateString.split("thru ")[1];
  } else if (dateString.includes(" thru ")) {
    [startString, endString] = dateString.split(" thru ");
  } else if (dateString.includes("-")) {
    [startString, endString] = dateString.split("-");
  } else {
    startString = dateString;
  }

  const startDateType = startString.includes("/") ? "month_day" : "day_of_week";

  let startDate, endDate;
  if (startDateType === "month_day") {
    const [startMonth, startDay] = startString.split("/");

    startDate = DateTime.fromObject({
      year:
        relativeDate.year + (parseInt(startMonth) < relativeDate.month ? 1 : 0),
      month: parseInt(startMonth),
      day: parseInt(startDay),
      hour: 12,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    endDate = startDate;
  } else if (startDateType === "day_of_week") {
    const startDayOfWeek = DAYS_OF_WEEK.indexOf(startString) + 1;
    if (startDayOfWeek < 0) {
      throw new Error({ msg: "Unexpected day of week", dateString });
    }

    const dayDelta = (7 + startDayOfWeek - relativeDate.weekday) % 7;
    startDate = relativeDate
      .plus({ days: dayDelta })
      .set({ hour: 12, minute: 0 });
    endDate = startDate;
  }

  if (endString) {
    const endDateType =
      startDateType === "month_day"
        ? "month_day"
        : endString.includes("/")
        ? "month_day"
        : "day_of_week";

    if (endDateType === "month_day") {
      let endMonth, endDay;

      if (endString.includes("/")) {
        [endMonth, endDay] = endString.split("/");
      } else {
        endMonth = "" + startDate.month;
        endDay = endString;
      }

      endDate = DateTime.fromObject({
        year:
          relativeDate.year + (parseInt(endMonth) < relativeDate.month ? 1 : 0),
        month: parseInt(endMonth),
        day: parseInt(endDay),
        hour: 12,
        minute: 0,
        second: 0,
        millisecond: 0,
      });
    } else if (endDateType === "day_of_week") {
      const endDayOfWeek = DAYS_OF_WEEK.indexOf(endString) + 1;
      if (endDayOfWeek < 0) {
        throw new Error({ msg: "Unexpected day of week", dateString });
      }

      const dayDelta = (7 + endDayOfWeek - relativeDate.weekday) % 7;
      endDate = relativeDate
        .plus({ days: dayDelta })
        .set({ hour: 12, minute: 0 });

      while (endDate < startDate) {
        /**
         * If somehow endDate is before startDate and endDate is a day of week,
         * we likely used the wrong relativeDate. We'll keep adding weeks
         * until the problem is resolved.
         */
        endDate = endDate.plus({ days: 7 });
      }
    }
  }

  return {
    start: startDate,
    end: endDate,
  };
};

/**
 *
 * @param {string} dateString
 * @param {DateTime} relativeDate
 * @returns {{ start: DateTime, end: DateTime }[]}
 */
const parseDateAsRange = (dateString, relativeDate) => {
  if (!dateString) throw new Error("Expected value missing");

  if (dateString.match(" thru ")) {
    const [startRange, endRange] = dateString.split(" thru ");
    const { start } = parseDate(startRange, relativeDate);
    const { end } = parseDate(endRange, relativeDate);
    const delta = end.diff(start, "days").days;

    return new Array(delta + 1).fill(0).map((_, index) => ({
      start: start.plus({ days: index }),
      end: start.plus({ days: index }),
    }));
  } else if (dateString.includes("-")) {
    let [startRange, endRange] = dateString.split("-");
    const { start } = parseDate(startRange, relativeDate);
    if (startRange.includes("/") && !endRange.includes("/")) {
      endRange = `${startRange.split("/")[0]}/${endRange}`;
    }
    const { end } = parseDate(endRange, relativeDate);
    const delta = end.diff(start, "days").days;

    return new Array(delta + 1).fill(0).map((_, index) => ({
      start: start.plus({ days: index }),
      end: start.plus({ days: index }),
    }));
  } else {
    return [parseDate(dateString, relativeDate)];
  }
};

const DAYS_OF_WEEK = ["mon", "tues", "weds", "thurs", "fri", "sat", "sun"];
const DAY_OF_WEEK_REGEX = `(${DAYS_OF_WEEK.join("|")})`;
const MONTH_DAY_FIRST_REGEX = `\\d{1,2}/\\d{1,2}`;
const MONTH_DAY_LAST_REGEX = `\\d{0,2}/?\\d{1,2}`;
const DATE_REGEX = `(${DAY_OF_WEEK_REGEX}|${MONTH_DAY_FIRST_REGEX})((-| thru )(${DAY_OF_WEEK_REGEX}|${MONTH_DAY_LAST_REGEX}))?`;
const TIME_REGEX = "\\(?[\\d:]+?(am|pm)?(-[\\d:]+?)?(am|pm)\\)?";
const FILTERS = [
  {
    key: "weekends",
    filter: (dateTime) => dateTime.weekday === 6 || dateTime.weekday === 7,
  },
  {
    key: "mondays",
    filter: (dateTime) => dateTime.weekday === 1,
  },
  {
    key: "tuesdays",
    filter: (dateTime) => dateTime.weekday === 2,
  },
  {
    key: "wednesdays",
    filter: (dateTime) => dateTime.weekday === 3,
  },
  {
    key: "thursdays",
    filter: (dateTime) => dateTime.weekday === 4,
  },
  {
    key: "fridays",
    filter: (dateTime) => dateTime.weekday === 5,
  },
  {
    key: "saturdays",
    filter: (dateTime) => dateTime.weekday === 6,
  },
  {
    key: "sundays",
    filter: (dateTime) => dateTime.weekday === 7,
  },
];
const FILTER_REGEX = `(${FILTERS.map(({ key }) => key).join("|")})`;

const REGEXES = [
  {
    name: "nowThruFutureDate",
    regex: new RegExp(
      `(?<!${DATE_REGEX} )thru ${DATE_REGEX}(?=\\.|:|;|/| )`,
      "g"
    ),
    getData: (match, relativeDate) => {
      const { start, end } = parseDate(match, relativeDate);

      return [
        {
          start,
          end: end.plus({ days: 1 }),
          hasTime: false,
        },
      ];
    },
  },
  {
    name: "dateAndMultipleTimes",
    regex: new RegExp(`${DATE_REGEX} ${TIME_REGEX} \\+ ${TIME_REGEX}`, "g"),
    getData: (match, relativeDate) => {
      const [dateAndFirstTimeString, secondTimeString] = match.split(" + ");
      const [dateString, firstTimeString] =
        dateAndFirstTimeString.split(/(?<! thru) (?!thru )/);

      const dates = parseDateAsRange(dateString, relativeDate);
      const firstTime = parseTime(firstTimeString);
      const secondTime = parseTime(secondTimeString);

      return dates
        .map(({ start, end }) => [
          {
            start: start.set({
              hour: firstTime.startHour,
              minute: firstTime.startMinute,
            }),
            end: end
              .set({
                hour: firstTime.endHour ?? firstTime.startHour,
                minute: firstTime.endHour
                  ? firstTime.endMinute
                  : firstTime.startMinute,
              })
              .plus(typeof firstTime.endHour !== "undefined" ? {} : { hours: 1 })
              .plus(firstTime.carryDay ? { days: 1 } : {}),
            hasTime: true,
          },
          {
            start: start.set({
              hour: secondTime.startHour,
              minute: secondTime.startMinute,
            }),
            end: end
              .set({
                hour: secondTime.endHour ?? secondTime.startHour,
                minute: secondTime.endHour
                  ? secondTime.endMinute
                  : secondTime.startMinute,
              })
              .plus(typeof secondTime.endHour !== "undefined" ? {} : { hours: 1 })
              .plus(secondTime.carryDay ? { days: 1 } : {}),
            hasTime: true,
          },
        ])
        .flat();
    },
  },
  {
    name: "multipleDatesAndTime",
    regex: new RegExp(
      `${DATE_REGEX} \\+ ${DATE_REGEX}( ${TIME_REGEX})?(?=\\.|:|;|/| )`,
      "g"
    ),
    getData: (match, relativeDate) => {
      const [firstDateString, secondDateAndTimeString] = match.split(" + ");
      const [secondDateString, timeString] =
        secondDateAndTimeString.split(/(?<! thru) (?!thru )/);

      const time = timeString ? parseTime(timeString) : undefined;

      if (time) {
        const firstDates = parseDateAsRange(firstDateString, relativeDate);
        const secondDates = parseDateAsRange(secondDateString, relativeDate);

        return [...firstDates, ...secondDates].map(({ start, end }) => ({
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
        }));
      } else {
        const firstDate = parseDate(firstDateString, relativeDate);
        const secondDate = parseDate(secondDateString, relativeDate);

        return [
          {
            start: firstDate.start,
            end: firstDate.end.plus({ days: 1 }),
            hasTime: false,
          },
          {
            start: secondDate.start,
            end: secondDate.end.plus({ days: 1 }),
            hasTime: false,
          },
        ];
      }
    },
  },
  {
    name: "filteredReversedDateAndTime",
    regex: new RegExp(
      `${FILTER_REGEX} ${TIME_REGEX} ${DATE_REGEX}(?=\\.|:|;|/| )`,
      "g"
    ),
    getData: (match, relativeDate) => {
      const [filterString, timeString, dateString] =
        match.split(/(?<! thru) (?!thru )/);

      const { filter } = FILTERS.find(({ key }) => filterString === key);
      const time = parseTime(timeString);
      const dates = parseDateAsRange(dateString, relativeDate);

      return dates
        .filter(({ start }) => filter(start))
        .map(({ start, end }) => ({
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
        }));
    },
  },
  {
    name: "filteredBasicDateAndTime",
    regex: new RegExp(
      `${FILTER_REGEX} ${DATE_REGEX} ${TIME_REGEX}(?=\\.|:|;|/| )`,
      "g"
    ),
    getData: (match, relativeDate) => {
      const [filterString, dateString, timeString] =
        match.split(/(?<! thru) (?!thru )/);

      const { filter } = FILTERS.find(({ key }) => filterString === key);
      const time = parseTime(timeString);
      const dates = parseDateAsRange(dateString, relativeDate);

      return dates
        .filter(({ start }) => filter(start))
        .map(({ start, end }) => ({
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
        }));
    },
  },
  {
    name: "reversedDateAndTime",
    regex: new RegExp(`${TIME_REGEX} ${DATE_REGEX}(?=\\.|:|;|/| )`, "g"),
    getData: (match, relativeDate) => {
      const [timeString, dateString] = match.split(/(?<! thru) (?!thru )/);

      const time = parseTime(timeString);
      const dates = parseDateAsRange(dateString, relativeDate);

      return dates.map(({ start, end }) => ({
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
      }));
    },
  },
  {
    name: "basicDateAndTime",
    regex: new RegExp(`${DATE_REGEX}( ${TIME_REGEX})?(?=\\.|:|;|/| )`, "g"),
    getData: (match, relativeDate) => {
      const [dateString, timeString] = match.split(/(?<! thru) (?!thru )/);

      const time = timeString ? parseTime(timeString) : undefined;

      if (time) {
        const dates = parseDateAsRange(dateString, relativeDate);

        return dates.map(({ start, end }) => ({
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
        }));
      } else {
        const { start, end } = parseDate(dateString, relativeDate);

        return [
          {
            start,
            end: end.plus({ days: 1 }),
            hasTime: false,
          },
        ];
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
  for (const { name, regex, getData } of REGEXES) {
    const matches = nodeText.match(regex);

    if (matches && matches.length > 0) {
      return getData(matches[0], relativeDate).map((result) => ({
        ...result,
        debug: { name, dateTimeMatches: matches },
      }));
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
    console.warn({
      msg: "Unexpected tag, skipping",
      expectedTag: "P",
      tag: node.tagName,
      textContent: node.textContent,
    });
    return null;
  }

  const titleNode = node.querySelector("b");
  if (!titleNode) {
    console.warn({
      msg: "No title node found, skipping",
      textContent: node.textContent,
      outerHtml: node.outerHTML,
    });
    return null;
  }

  const nodeText = node.textContent;

  const location = nodeText.match(
    /(\.\W|:\W|\bto\W+|\bat\W+|\bin\W+)\b(?<location>((?!\.\W|:\W|\bhost|\bfeatur|\bto\b|\bat\b|\bin\b).)*?\b \([a-z ]*?\))/
  );
  const link = node.querySelector("a");
  const dateTimes = parseDateTime(nodeText, relativeDate);

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
      titleNode.textContent,
      nodeText + (link ? "\n\n" + link.href : ""),
      location?.groups?.location,
      start,
      end,
      hasTime,
      { ...debug, locationMatches: location }
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
