import { google } from "googleapis";

/**
 * Load or request or authorization to call APIs.
 *
 */
export async function authorize() {
  return new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
}
