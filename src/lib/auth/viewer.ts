import { createClient } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  email: string | null;
};

export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const subject = claims?.sub;

  if (error || typeof subject !== "string" || subject.length === 0) {
    return null;
  }

  const email = claims?.email;
  return {
    id: subject,
    email: typeof email === "string" ? email : null,
  };
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    throw new AuthenticationError();
  }
  return viewer;
}

export class AuthenticationError extends Error {
  readonly status = 401;
  readonly code = "authentication_required";

  constructor() {
    super("Sign in to continue.");
    this.name = "AuthenticationError";
  }
}
