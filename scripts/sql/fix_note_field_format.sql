-- Create a stored procedure to fix note field format
CREATE OR REPLACE FUNCTION fix_note_field_format()
RETURNS void AS $$
BEGIN
  UPDATE public.cantonese_corpus_all
  SET note = note->0
  WHERE jsonb_typeof(note) = 'array'
    AND jsonb_array_length(note) = 1;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION fix_note_field_format() TO authenticated;
GRANT EXECUTE ON FUNCTION fix_note_field_format() TO service_role;