UPDATE "corpus_collection_activities"
SET "media_requirements" = '{"requiredTypes":["image"]}'::jsonb
WHERE "media_requirements" = '{}'::jsonb
   OR "media_requirements" ? 'images'
   OR "media_requirements" ? 'allowedTypes';
