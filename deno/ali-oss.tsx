/* 
the api for agent-market.
*/
// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.
import { Router } from "oak";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAdminPassword } from "./main.tsx";

console.log("Hello from Ali OSS API!");


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

// Generate Aliyun OSS signature for upload
function generateOSSSignature(
  accessKeySecret: string,
  expiration: string,
  conditions: any[],
  policyBase64: string
): string {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(accessKeySecret);
  const message = encoder.encode(policyBase64);

  // Use Web Crypto API for HMAC-SHA1
  return ""; // Will be computed async
}

// Generate OSS upload policy and signature
async function generateOSSUploadPolicy(
  bucket: string,
  dir: string,
  expireSeconds: number = 3600
): Promise<{
  accessId: string;
  policy: string;
  signature: string;
  dir: string;
  host: string;
  expire: number;
}> {
  const accessKeyId = Deno.env.get("ALI_OSS_ACCESS_KEY_ID") ?? "";
  const accessKeySecret = Deno.env.get("ALI_OSS_ACCESS_KEY_SECRET") ?? "";
  const region = Deno.env.get("ALI_OSS_REGION") ?? "cn-guangzhou";

  const host = `https://${bucket}.oss-${region}.aliyuncs.com`;
  const expireTime = Math.floor(Date.now() / 1000) + expireSeconds;
  const expiration = new Date(expireTime * 1000).toISOString();

  // Create policy
  const policy = {
    expiration: expiration,
    conditions: [
      ["content-length-range", 0, 104857600], // Max 100MB
      ["starts-with", "$key", dir],
    ],
  };

  const policyBase64 = btoa(JSON.stringify(policy));

  // Generate signature using HMAC-SHA1
  const encoder = new TextEncoder();
  const keyData = encoder.encode(accessKeySecret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(policyBase64)
  );

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  return {
    accessId: accessKeyId,
    policy: policyBase64,
    signature: signature,
    dir: dir,
    host: host,
    expire: expireTime,
  };
}

export const aliOSSRouter = new Router();

aliOSSRouter.get("/ali-oss", async (context) => {
  context.response.body = { result: "Hello, Ali OSS API of AI DIMSUM!" };
});

// Get OSS upload credentials (presigned policy)
// POST /oss/upload-policy
// Body: { password: string, bucket: string, dir: string, expireSeconds?: number }
aliOSSRouter.post("/admin/oss/upload-policy", async (context) => {
  try {
    const body = await context.request.body({ type: "json" });
    const content = await body.value;
    const { password, bucket, dir, expireSeconds } = content;

    // Verify admin password
    if (!(await verifyAdminPassword(context, password))) {
      return;
    }

    if (!bucket || !dir) {
      context.response.status = 400;
      context.response.body = { error: "Missing required fields: bucket, dir" };
      return;
    }

    const uploadPolicy = await generateOSSUploadPolicy(
      bucket,
      dir,
      expireSeconds || 3600
    );

    context.response.body = {
      success: true,
      data: uploadPolicy,
    };
  } catch (error) {
    console.error("Error generating upload policy:", error);
    context.response.status = 500;
    context.response.body = { error: "Failed to generate upload policy" };
  }
});

// Direct file upload to OSS
// POST /oss/upload
// Body: FormData with { password, bucket, dir, file }
aliOSSRouter.post("/admin/oss/upload", async (context) => {
  try {
    const body = context.request.body({ type: "form-data" });
    // Use maxSize to keep file in memory instead of writing to temp file
    // This is required for serverless environments (Deno Deploy, Supabase Edge Functions)
    const formData = await body.value.read({ maxSize: 100 * 1024 * 1024 }); // 100MB max
    const password = formData.fields["password"] as string;
    const bucket = formData.fields["bucket"] as string;
    const dir = formData.fields["dir"] as string;
    const customFileName = formData.fields["fileName"] as string;
    const uploadedFile = formData.files?.[0];

    // Verify admin password
    if (!(await verifyAdminPassword(context, password))) {
      return;
    }

    if (!bucket || !dir || !uploadedFile) {
      context.response.status = 400;
      context.response.body = { error: "Missing required fields: bucket, dir, file" };
      return;
    }

    const accessKeyId = Deno.env.get("ALI_OSS_ACCESS_KEY_ID") ?? "";
    const accessKeySecret = Deno.env.get("ALI_OSS_ACCESS_KEY_SECRET") ?? "";
    const region = Deno.env.get("ALI_OSS_REGION") ?? "cn-guangzhou";

    const host = `https://${bucket}.oss-${region}.aliyuncs.com`;
    // Use customFileName if provided, otherwise fallback to original metadata
    const fileName = customFileName || uploadedFile.originalName || uploadedFile.filename || "upload";
    const objectKey = `${dir}${fileName}`;
    const date = new Date().toUTCString();
    const contentType = uploadedFile.contentType || "application/octet-stream";

    // File content is now in memory as Uint8Array (due to maxSize option)
    const fileContent = uploadedFile.content!;

    // Generate signature for PUT request
    const stringToSign = `PUT\n\n${contentType}\n${date}\n/${bucket}/${objectKey}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(accessKeySecret),
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(stringToSign)
    );
    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // Upload to OSS
    const uploadResponse = await fetch(`${host}/${objectKey}`, {
      method: "PUT",
      headers: {
        "Authorization": `OSS ${accessKeyId}:${signature}`,
        "Content-Type": contentType,
        "Date": date,
      },
      body: fileContent,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("OSS upload error:", errorText);
      context.response.status = 500;
      context.response.body = { error: "Failed to upload to OSS", details: errorText };
      return;
    }

    context.response.body = {
      success: true,
      url: `${host}/${objectKey}`,
      key: objectKey,
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    context.response.status = 500;
    context.response.body = { error: "Failed to upload file" };
  }
});
