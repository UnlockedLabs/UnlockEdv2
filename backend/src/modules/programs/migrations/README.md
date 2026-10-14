# Programs migrations

Goose `.sql` migrations for this module, embedded in the server binary. They run
after core's, and their versions are tracked in `public.goose_db_version_programs`.

Never edit a migration that has been merged; add a new one.
