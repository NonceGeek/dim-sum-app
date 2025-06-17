/**
 * Script to fix the note field format in the cantonese_corpus_all table
 * 
 * Purpose:
 * This script updates records in the cantonese_corpus_all table where the note field
 * is stored as a single-element array. It extracts the first element from these arrays
 * and updates the note field to contain just that element.
 * 
 * Prerequisites:
 * 1. Deno runtime installed
 * 2. Environment variables set:
 *    - SUPABASE_URL: Your Supabase project URL
 *    - SUPABASE_SERVICE_ROLE_KEY: Your Supabase service role key
 * 3. SQL stored procedure created:
 *    - Location: scripts/sql/fix_note_field_format.sql
 *    - Execute this SQL file in your Supabase SQL editor before running this script
 * 
 * Usage:
 * 1. Set the required environment variables:
 *    export SUPABASE_URL='your-supabase-url'
 *    export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
 * 
 * 2. Create the stored procedure:
 *    - Open your Supabase project
 *    - Go to SQL Editor
 *    - Copy and paste the contents of scripts/sql/fix_note_field_format.sql
 *    - Execute the SQL
 * 
 * 3. Run the script:
 *    deno run --allow-env --allow-net scripts/fix_note_field.ts
 * 
 * Note: This script requires the fix_note_field_format stored procedure to be
 * created in your Supabase database first.
 */

// @ts-nocheck
// scripts/fix_note_field.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

try {
  console.log("🚀 Starting to fix note field data format...");

  const { data, error } = await supabase.rpc('fix_note_field_format');

  if (error) {
    throw error;
  }

  console.log("✅ Data fix completed.");
} catch (error) {
  console.error("❌ Error during execution:", error);
}
