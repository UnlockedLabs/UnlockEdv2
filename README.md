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
-   Run `sail artisan migrate:fresh --seed`
-   Run `sail npm install`
-   Run `sail npm run dev`
-   Open http://localhost
-   Login with `SuperAdmin` and password: `ChangeMe!`
-   You will be prompted immediately to set a new password, and then you will be redirected to the dashboard.

### AUTH/Passport Setup:

-   In the command line, run: `sail artisan passport:install`
    This will generate two sets of keys, each one with a client ID and a secret. The first set, you must copy the client ID and SECRET and add them to your .env file like so:

```
PASSPORT_PERSONAL_ACCESS_CLIENT_ID="1"
PASSPORT_PERSONAL_ACCESS_CLIENT_SECRET="o06w5S8I71RVMGHhocUVHCy0cbyMoVqxsHB8Rd3I"
```

### NOTE: If you have previously installed passport, you may need to add a `--force` flag to the command to overwrite the existing keys. (you will still have to manually copy the new client info to the .env file)

#### If you run sail artisan migrate:fresh (unless you use --env=testing), it will overwrite the client info in the database, and you will need to re-install/configure passport.

### API Testing from a client (Postman, curl, etc):

The API is protected by Passport, so you will need to use the client ID and secret to authenticate. You will need to get an OAuth token using a password grant. First, you will need to run the command: `sail artisan passport:client --password`, and save the client ID and secret. Then, you can use the following command to get an OAuth token:

```php
use Illuminate\Support\Facades\Http;

$response = Http::asForm()->post('http://localhost/oauth/token', [
    'grant_type' => 'password',
    'client_id' => '**client-id**',
    'client_secret' => '**client-secret**',
    'username' => 'admin@unlocked.v2',
    'password' => 'ChangeMe!',// will be changed after first login
    'scope' => '*',
]);

$access = $response->json()['access_token'];
```

That will return a response with an access token, that you must include in future requests to the API.
`curl 'http://localhost/api/v1/users' -H 'Authorization: Bearer ***access_token***'`

#### NOTE:

-   Run `sail artisan db:seed --class=TestSeeder` to seed the database with test data for local UI development if you need tables populated with fake data.

## Style/Linting

-   PHP: Run `./vendor/bin/pint` or adjust your editor to run it on save.
-   TS: Run `npx prettier -w .` before committing, or adjust your editor to run it on save.

#### These commands _will_ run automatically in a git hook before each commit, so you technically don't have to worry about it but if you run them beforehand, you will most likely not need to re-stage and amend your commit with the fixes will make. IF for some reason you need to skip the hooks, you can run `git commit --no-verify`but do not do this unless you know what you are doing and you understand the CI/CD will fail if you do.

# FAQ:

**Why is Mysql not starting properly?:** (Sail)

-   While still running `sail up` in the background, open a new terminal and run `docker-compose down --volumes`, then after it fully shuts down, run `./vendor/bin/sail up --build`

-   Make sure you have a `.env` file in the root directory. In my environment, I have to have a `.env` with the DB_HOST set to the `IP` I get after running `docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' unlockedv2_mysql_1` (if `unlockedv2_mysql_1` is the name of the mysql container, you can find this out by running `docker ps`)

**Why is the content not displaying, or the page is blank or receiving 500 errors?** (Sail)

_This could be any one of the following, or a combination_

-   Run `php artisan config:clear`
-   Run `php artisan config:cache`

-   Run `php artisan key:generate`

-   Run `sail artisan migrate:fresh --seed` to rebuild the database and seed it with the default data.

# Testing

-   Run `sail artisan test`
-   (Or alternatively ./vendor/bin/pest)

# Debugging

Two tools you can use to aid in debugging:

-   laravel-debugbar - This is a package to integrate PHP Debug Bar with Laravel: Run `composer require barryvdh/laravel-debugbar --dev`
-   React Developer Tools. This is available for several browser flavors and available on their website: https://react.dev/learn/react-developer-tools

Debugbar for Laravel is a package to integrate [PHP Debug Bar](http://phpdebugbar.com/) with Laravel. React Developer Tools is used to inspect REACT components, edit props and state, and identify performance problems.

# License

UnlockEdv2 is open-sourced software licensed under the [Apache License, Version 2.0](https://opensource.org/license/apache-2-0/).
