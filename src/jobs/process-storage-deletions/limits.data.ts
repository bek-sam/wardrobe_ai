/**
 * Attempt budget before an object is dead-lettered.
 *
 * With the existing backoff (30s doubling, capped at one hour) eight attempts
 * span roughly four hours. That is long enough to ride out a Storage outage or
 * a transient permission problem, and short enough that a genuinely stuck
 * object surfaces on the health endpoint the same working day rather than
 * retrying forever and hiding in the queue depth.
 */
export const MAX_STORAGE_DELETION_ATTEMPTS = 8;
