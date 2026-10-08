import { z } from "zod";
import { ApiError } from "@/lib/http";

const googleProfileSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.union([z.string(), z.boolean()]).optional(),
  name: z.string().optional(),
  aud: z.string(),
  iss: z.string().optional(),
  nonce: z.string().optional(),
});

export async function verifyGoogleIdToken(
  credential: string,
  clientId: string,
  expectedNonce?: string,
) {
  const tokenInfoUrl = new URL("https://oauth2.googleapis.com/tokeninfo");
  tokenInfoUrl.searchParams.set("id_token", credential);
  const googleResponse = await fetch(tokenInfoUrl, { cache: "no-store" });
  if (!googleResponse.ok) throw new ApiError("Google credential is invalid or expired", 401);

  const profile = googleProfileSchema.safeParse(await googleResponse.json());
  if (
    !profile.success ||
    profile.data.aud !== clientId ||
    (profile.data.iss !== undefined &&
      profile.data.iss !== "accounts.google.com" &&
      profile.data.iss !== "https://accounts.google.com") ||
    (profile.data.email_verified !== "true" && profile.data.email_verified !== true) ||
    (expectedNonce !== undefined && profile.data.nonce !== expectedNonce)
  ) {
    throw new ApiError("Google account could not be verified", 401);
  }

  return profile.data;
}
