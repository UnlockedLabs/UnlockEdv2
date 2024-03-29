# UnlockEdv2

## Requirements

Currently, UnlockEdv2 is tested on Windows (WSL), Mac (homebrew) and Ubuntu.

-   Docker (Docker Desktop on WSL)
-   PHP and Composer (Platform specific)

## Development

If you would like to contribute, please have a look at our [contribution guidelines](CONTRIBUTING.md).

### Dependencies (Local)

-   PHP 8.2
-   Composer
-   Node.js > 18.0
-   Docker && Docker-Compose

### Dependencies (Deployment/Production)

-   PHP 8.2
-   Composer
-   Node.js > 18.0
-   MySql 8.0 | MariaDB
-   Apache2 | Nginx

The commands below assume you have a shell alias setup in your .bashrc or .zshrc file for the sail command: `alias sail='[ -f sail ] && sh sail || sh vendor/bin/sail`. If you haven't configured that, you can substitute any call to `sail` with `./vendor/bin/sail`.

-   Clone the repository
-   Copy ‘.env.example’ to ‘.env’
-   Run `composer install`
-   Run `sail up`
-   Run `sail artisan migrate:fresh --seed`
-   Run `sail npm install`
-   Run `sail npm run dev`
-   Open `http://localhost` in your browser
-   Login with `SuperAdmin` and password: `ChangeMe!`
-   You will be prompted immediately to set a new password, and then you will be redirected to the dashboard.
-   You can seed test data into the database by running `sail artisan db:seed --class=TestSeeder`

### AUTH/Passport Setup:

-   In the command line, run: `sail artisan passport:install`
    This is only needed for integration with `Canvas-LMS` currently, and shouldn't be needed for most local development.

### NOTE: If you have previously installed passport, you may need to add a `--force` flag to the command to overwrite the existing keys. (you will still have to manually copy the new client info to the .env file)

#### If you run sail artisan migrate:fresh (unless you use --env=testing), it will overwrite the client info in the database, and you will need to re-install/configure passport.

#### NOTE:

-   Run `sail artisan db:seed --class=TestSeeder` to seed the database with test data for local UI development if you need tables populated with fake data.

## Style/Linting

-   Naming and style convention is outlined in our CONTRIBUTING.md file.
-   PHP: Run `./vendor/bin/pint` or adjust your editor to run it on save.
-   TS: Run `npx prettier -w .` before committing, or adjust your editor to run it on save.

#### These commands _will_ run automatically in a git hook before each commit, so you technically don't have to worry about it but if you run them beforehand, you will most likely not need to re-stage and amend your commit with the fixes will make. IF for some reason you need to skip the hooks, you can run `git commit --no-verify`but do not do this unless you know what you are doing and you understand the CI/CD will fail if you do.

# FAQ:

**Why is docker not starting properly when I run `sail up`?**

> Chances are, this is a permissions issue with docker. If you are new to docker, you may need to run `sudo usermod -aG docker $USER`
> to add yourself to the docker group. You will need to log out and back in for this to take effect.
> Try starting docker with `sudo dockerd`, or restarting the daemon with `sudo systemctl restart docker.service`, followed by `docker run hello-world`
> to ensure docker is running properly before again trying the `sail up` command.

**Why am I getting a `Laravel open stream failed: Permission (laravel.log || boostrap/cache/*.php)` error when I open my web browser?**

-   This occurs on most systems during a new install. To fix this, you can run the following commands in the root directory of the project:
    `sudo chown -R www-data:www-data storage bootstrap/cache`

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

-   To generate a template for a Controller crud test, run:
    #### `'sail artisan app:make-controller-test {name_of_controller}'`
    and follow the prompts to generate the test for your handler.

NOTE: This is only a template and will need to be modified to fit your specific needs

# Debugging

Two tools you can use to aid in debugging:

-   laravel-debugbar - This is a package to integrate PHP Debug Bar with Laravel: Run `composer require barryvdh/laravel-debugbar --dev`
-   React Developer Tools. This is available for several browser flavors and available on their website: https://react.dev/learn/react-developer-tools

Debugbar for Laravel is a package to integrate [PHP Debug Bar](http://phpdebugbar.com/) with Laravel. React Developer Tools is used to inspect REACT components, edit props and state, and identify performance problems.

# License

UnlockEdv2 is open-sourced software licensed under the [Apache License, Version 2.0](https://opensource.org/license/apache-2-0/).
