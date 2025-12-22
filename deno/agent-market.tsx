/* 
the api for agent-market.
*/
// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
import { Router } from "oak";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("Hello from Agent Market API!");

// Admin password verification function
async function verifyAdminPassword(
  context: any,
  password: string
): Promise<boolean> {
  const adminPwd = Deno.env.get("ADMIN_PWD");
  if (!password || password !== adminPwd) {
    context.response.status = 401;
    context.response.body = { error: "Unauthorized: Invalid password" };
    return false;
  }
  return true;
}

// API key verification function
async function verifyAPIKey(context: any, api_key: string): Promise<any> {
  // Convert api key format from "0x..." to "\\x..." to adapt with the bytea format in supabase
  let formattedApiKey = api_key;
  if (api_key && api_key.startsWith("0x")) {
    formattedApiKey = "\\x" + api_key.slice(2);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Get user_id and status by api key in table api_key
  const { data: apiKeyData, error: apiKeyError } = await supabase
    .from("api_key")
    .select("*")
    .eq("key", formattedApiKey)
    .single();

  if (apiKeyError || !apiKeyData) {
    context.response.status = 401;
    context.response.body = { error: "Invalid API key" };
    return null;
  }

  // If status != "APPROVED", return error
  if (apiKeyData.status !== "APPROVED") {
    context.response.status = 403;
    context.response.body = { error: "API key not approved" };
    return null;
  }

  // the called_times field in table api_key should be incremented by 1.
  const { data: updateData, error: updateError } = await supabase
    .from("api_key")
    .update({ called_times: apiKeyData.called_times + 1 })
    .eq("id", apiKeyData.id);
  if (updateError) {
    console.error("Error updating called_times:", updateError);
    return null;
  }

  return apiKeyData;
}

// Get user by id or email function
async function getUserByIdOrEmail(id?: string, email?: string): Promise<any> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Build query based on id or email
  let query = supabase.from("User").select("*");

  if (id) {
    query = query.eq("id", id);
  } else if (email) {
    query = query.eq("email", email);
  } else {
    return null; // Neither id nor email provided
  }

  const { data: userData, error: selectError } = await query.single();

  if (selectError || !userData) {
    console.error("Error selecting user:", selectError);
    return null;
  }

  // Get Account items by userId and append to userData
  const { data: accountData, error: accountError } = await supabase
    .from("Account")
    .select("*")
    .eq("userId", userData.id);

  if (accountError) {
    console.error("Error fetching accounts:", accountError);
    // Return user without accounts if account fetch fails
    return {
      ...userData,
      accounts: [],
    };
  }

  // Return user data with accounts appended
  return {
    ...userData,
    accounts: accountData || [],
  };
}

export const agentMarketRouter = new Router();

agentMarketRouter.get("/agent-market", async (context) => {
  context.response.body = { result: "Hello, Agent Market API!" };
});
