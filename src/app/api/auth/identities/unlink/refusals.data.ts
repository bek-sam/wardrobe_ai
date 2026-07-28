/**
 * Why an unlink was refused, in words the user can act on.
 *
 * `last_recovery_method` is the one worth spelling out: the account still has
 * another way in today, but removing this one would leave nothing that can get
 * the user back should that other credential be lost.
 */
export const UNLINK_REFUSALS = {
  not_linked: {
    status: 404,
    message: "That sign-in method is not linked to your account.",
  },
  last_identity: {
    status: 409,
    message: "Add another sign-in method before removing this one — it is the only way in.",
  },
  last_recovery_method: {
    status: 409,
    message:
      "This is your only recoverable sign-in method. Add a password or link Google first, otherwise losing the other method would lock you out for good.",
  },
} as const;
