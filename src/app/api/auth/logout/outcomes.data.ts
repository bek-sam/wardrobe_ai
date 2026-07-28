/**
 * Where each sign-out scope lands and what the user is told.
 *
 * The copy names the scope explicitly, because "signed out" is ambiguous in a
 * product with three different sign-out buttons, and because a user who
 * pressed "sign out everywhere" after losing a device needs to know it
 * actually covered this device too.
 *
 * The note about already-issued tokens is not a disclaimer for its own sake:
 * revocation invalidates refresh tokens immediately, but an access token
 * already in flight stays valid until it expires (one hour by default).
 */
export const LOGOUT_OUTCOMES = {
  local: {
    path: "/login",
    notice: "You are signed out on this device. Your other devices are still signed in.",
  },
  others: {
    path: "/settings",
    notice:
      "Your other devices were signed out; this one stays signed in. Access already granted elsewhere can persist for up to an hour.",
  },
  global: {
    path: "/login",
    notice:
      "You are signed out everywhere, including this device. Access already granted can persist for up to an hour.",
  },
} as const;
