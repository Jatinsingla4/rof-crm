// Business calendar for the tests: the same rule as the application (packages/api/src/utils/business-date.ts), Asia/Kolkata.
// A test that builds "today", "tomorrow" or "N days later" with toISOString() gets the UTC day, which is yesterday for 5.5 hours every night in India.
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
export const bizDate = (instant = Date.now()) => fmt.format(instant);
export const bizToday = () => bizDate();
export const bizLater = (days) => bizDate(Date.now() + days * 864e5);
