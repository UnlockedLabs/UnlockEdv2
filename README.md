# UnlockEdv2

## Requirements

Currently, UnlockEdv2 is tested on Windows (WSL), Mac (homebrew) and Ubuntu.

-   Docker (Docker Desktop on WSL)
-   Php and Composer (Platform specific)

## Development

The commands below assume you have a shell alias setup in your .bashrc or .zshrc file for the sail command: `alias sail='[ -f sail ] && sh sail || sh vendor/bin/sail`. If you haven't configured that, you can substitute any call to `sail` with `./vendor/bin/sail`.

-   Clone the repository
-   Copy ‘.env.example’ to ‘.env’
-   Run `composer install`
-   Run `sail up`
-   Run `sail artisan migrate`
-   Run `sail npm install`
-   Run `sail npm run dev`
-   Open http://localhost
-   Register a user or login

## Style/Linting

-   PHP: Run `./vendor/bin/pint` or adjust your editor to run it on save.
-   TS: Run `npx prettier -w .` before committing, or adjust your editor to run it on save.

#### These commands _will_ run automatically before each commit, so you technically don't have to worry about it

## Database + Common Problems, Issues and Errors with initial build or setup:

**Mysql isn't starting properly:** (Sail)

-   While still running `sail up` in the background, open a new terminal and run `docker-compose down --volumes`, then after it fully shuts down, run `./vendor/bin/sail up --build`

-   Make sure you have a `.env` file in the root directory. In my environment, I have to have a `.env` with the DB_HOST set to the `IP` I get after running `docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' unlockedv2_mysql_1` (if `unlockedv2_mysql_1` is the name of the mysql container)

**Content isn't displaying, or the page is blank or receiving 500 errors:** (Sail)

_This could be any one of the following, or a combination_

-   Run `php artisan config:clear`
-   Run `php artisan config:cache`

-   Run `php artisan key:generate`

-   Run `sail artisan migrate:fresh --seed` to rebuild the database and seed it with the default data.

## Testing

-   Run `sail artisan test`
-   (Or alternatively ./vendor/bin/pest)

## License

UnlockEdv2 is open-sourced software licensed under the [Apache License, Version 2.0](https://opensource.org/license/apache-2-0/).
