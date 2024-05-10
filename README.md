## TODO:

Frontend:

 - Login form + reset password will throw error when wrong password is entered

Backend:

 - **Auth OIDC**: Canvas auth | Kolibri
 - Fetching `activities` from providers in the middleware, to be used by the `UserActivityMap`("gh contribution chart")


# UnlockEdv2

## Requirements

Currently, UnlockEdv2 is tested on Windows (WSL), Mac (homebrew) and Linux.

-   Docker && Docker Compose
-   Go 1.22
-   Node.js > 18.0
-   Yarn

## Development

If you would like to contribute, please have a look at our [contribution guidelines](CONTRIBUTING.md).

### Dependencies (Local)

-   Go 1.22
-   Node.js > 18.0
-   Docker && Docker-Compose

### Dependencies (Deployment/Production)

-   Node.js > 18.0
-   Postgres 16.0

-   Clone the repository
-   `cp .env.example .env && cp frontend/.env.example frontend/.env`
-   Run `MIGRATE_FRESH=true docker-compose up --build`
(This command only needs to be ran the first time, subsequently you may omit the
`MIGRATE_FRESH=true` flag)
-   Change directory to the frontend directory
-   Run `yarn install`
-   Run `yarn run dev`
-   Open `http://localhost:5173` in your browser
-   Login with `SuperAdmin` and password: `ChangeMe!`
-   You will be prompted immediately to set a new password, and then you will be redirected to the dashboard.

## Style/Linting

-   Naming and style convention is outlined in our CONTRIBUTING.md file.

#### Proper linting/formatting _will_ run automatically in a git hook before each commit. If you want to run them beforehand, you can `cd` into frontend and run `npx prettier -w .` or `cd backend` and `gofmt -w .` IF for some reason you need to skip the pre-commit hooks, you can run `git commit --no-verify`but _do not_ do this unless you know what you are doing and you understand the CI/CD will fail if you submit a PR.

# FAQ:

### Why is docker not starting properly?

> Chances are, this is a permissions issue with docker. If you are new to docker, you may need to run `sudo usermod -aG docker $USER`
> to add yourself to the docker group. You will need to log out and back in for this to take effect.
> Try starting docker with `sudo dockerd`, or restarting the daemon with `sudo systemctl restart docker.service`, followed by `docker run hello-world`
> to ensure docker is running properly before again trying the `sail up` command.

# Debugging

Two tools you can use to aid in debugging:

-   React Developer Tools. This is available for several browser flavors and available on their website: https://react.dev/learn/react-developer-tools

# License

UnlockEdv2 is open-sourced software licensed under the [Apache License, Version 2.0](https://opensource.org/license/apache-2-0/).
