## Plan to rewrite it in Go:

3. Auth OIDC: Canvas auth | Kolibri OIDC login TODO

4. New structure around Programs | Milestones | Outcomes | Content | User Mappings

5. Provider platforms /api/v1/provider-platforms **COMPLETED: Backend**

6. Category /api/v1/categories | Left-Menu mgmt

7. ProviderUserMapping | api/v1/users + api/v1/users/{id}/logins **COMPLETED: Backend**

8. UserActivity | api/v1/users/{id}/activity   **COMPLETED: Backend**

9. UserActivityMap | api/v1/users/{id}/activity-map



**User Roles** | middleware/route protection


## UI integration:


# UnlockEdv2

## Requirements

Currently, UnlockEdv2 is tested on Windows (WSL), Mac (homebrew) and Ubuntu.

-   Docker Compose
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
-   Copy ‘.env.example’ to ‘.env’
-   Run `MIGRATE_FRESH=true docker-compose up --build`
(This command only needs to be ran the first time, subsequently you may omit the
`MIGRATE_FRESH=true` flag)
-   Change directory to the frontend directory
-   Run `npm install`
-   Run `npm run dev`
-   Open `http://localhost` in your browser
-   Login with `SuperAdmin` and password: `ChangeMe!`
-   You will be prompted immediately to set a new password, and then you will be redirected to the dashboard.

## Style/Linting

-   Naming and style convention is outlined in our CONTRIBUTING.md file.
-   TS: Run `npx prettier -w frontend` from the root directory before committing, or adjust your editor to run it on save.
-   Go: Run `gofmt -w .` before committing, or more likely adjust your editor to run it on save.

#### These commands _will_ run automatically in a git hook before each commit, so you technically don't have to worry about it but if you run them beforehand, you will most likely not need to re-stage and amend your commit with the fixes will make. IF for some reason you need to skip the hooks, you can run `git commit --no-verify`but do not do this unless you know what you are doing and you understand the CI/CD will fail if you do.

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
