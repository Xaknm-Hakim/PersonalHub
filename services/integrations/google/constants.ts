export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly"
] as const;
export const GOOGLE_CALENDAR_SCOPE = GOOGLE_CALENDAR_SCOPES.join(" ");
export const GOOGLE_PROVIDER = "google";
export const GOOGLE_CALENDAR_NAME = "PersonalHub";
export const GOOGLE_OAUTH_COOKIE = "personalhub_google_oauth";
export const GOOGLE_CALLBACK_PATH = "/api/v1/integrations/google/callback";
