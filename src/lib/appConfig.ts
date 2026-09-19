// Public origin the app is served from. Used to build links embedded in emails
// (invite link, welcome email). No trailing slash — links are built as
// `${APP_BASE_URL}/path`.
export const APP_BASE_URL = "https://clearportfolio.com.au";

// Controls whether the invite UIs render the raw invite link + backup temporary
// password to the admin. Hidden for now (the invitee receives them by email).
// Flip to `true` to re-expose those sections; all the logic stays wired up.
export const SHOW_INVITE_CREDENTIALS: boolean = false;
