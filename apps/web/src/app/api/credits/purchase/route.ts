import { NextRequest } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { ApiError, errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) throw new ApiError("Please sign in to continue", 401);
    throw new ApiError("Demo purchases are disabled. Use the Paystack checkout on the pricing page.", 410);
  } catch (error) {
    return errorResponse(error, "credits/purchase");
  }
}