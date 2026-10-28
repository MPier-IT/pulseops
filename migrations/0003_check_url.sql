-- Preserve the endpoint used for each real check, including after an endpoint is edited.
ALTER TABLE checks ADD COLUMN checked_url TEXT;
