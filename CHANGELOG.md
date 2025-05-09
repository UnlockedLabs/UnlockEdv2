# Changelog

All notable changes to this project will be documented in this file.

## [0.0.4] - 2024-11-15

### 🚀 Features

- Add library database schema and migration
- Implement queries into kolibri provider middleware - issue 392
- Add unique constraint on milestones for user_id, course_id, extern_id
- Add prometheus middleware and endpoint
- Add additional prometheus metrics
- Add libraries api and tests
- Change status of PR to "In Review" when added to project
- Updated to use table-2
- Updated ui to meet specifications
- Kiwix library scraping, remove canvas seeder, make all hot reloadable
- Add open content management ui
- Add library reverse proxy middleware and handler, update frontend
- Add dynamic path values without rerendering PageNav component
- Added headers to all pages with px-8
- Download lib thumbnails, add route loader, fix job scheduler
- Add facility context switch and ui
- Add toast context to reduce code duplication
- Add facility management
- Brightspace integration  (#473)
- Brightspace data model
- Add Programs page to UI and seed program tags (#471)
- Create-department-wide-program-464 (#477)
- Add GetUsers, IntoImportUsers in provider-middleware
- Add video download capabilities
- Add manual retry to video downloads
- Add logic for the integration of brightspace milestones (#483)
- Create new program & mark department-wide (#485)
- Add timzone dropdown to system admin initial change password form
- Create feature access level checkboxes (#501)
- Impl import activity for course for BrightspaceService
- Feature flag and create system_admin role
- Finish feature flagging

### 🐛 Bug Fixes

- Removes calendar from student and admin portal frontend
- Cron tasks foreign key issue creating default cronjobs
- Cleanup git merge mistakes, broken tests
- Add omitted line back into code as requested in review
- Move model helpers to resource.go
- Added indexes to external_id and url
- Many many es-lints, enable build pre-commit to prevent ci failures
- Run all linters on push/pr, fix lints from latest changes
- Add error check per golangci-lint errors found
- Display provider oidc info properly
- Condense library handler to single index method
- Decrypt provider access key in middleware
- Add model hooks for access key encryption
- Unmapped provider user search
- Fixes toast alert colors
- Strict equality check for toast state
- Made requested changes to PR
- Adjusted tooltip name
- Increase course name with migration and alter kolibri input
- Dropdown links to user page changed to admin/student
- Changed text-alignment from left to right
- Added requested changes to detail and ul elements on the PageNav.tsx
- Use 64 bit int for total weekly activity to prevent overflow
- First collection shows in modify section
- Fixed some components
- All lints and type errors with new build
- Github action to use yarn to resolve deps
- Use larger integer types for activity data
- More frontend fixes and lints
- Lints with library component
- Use yarn to build in dockerfile
- Assorted fixes from migrating frontend build system
- All lints and type errors with new build
- Lints with library component
- Typescript lints
- Golangci lint use strings.equalfold for case insensitive comp
- Use proper id for open content provider in scheduler
- Adapt oidc login to new frontend route paradigm
- Frontend routing, toast, path variables, facility info
- Admin dashboard rendering issue
- Kolibri uuid issue, ensure accounts are properly created
- Consent form oidc login, kolibri course paths, navbar link
- Redirects in consent form and reset password auth
- Removed grade from ui
- Remove daisyUI navbar class to fix scrollbar
- Route loading loop, display open content providers
- Add exporting struct fields to temp struct
- Remove duplicate access key label
- Add order by to monthly activity and change left join to inner join on milestones
- Modify insert daily activity function to handle kolibri time delta
- Modify GetUserCourses to filter out other user's courses changing by left joins to inner joins
- Kick down goose end statement
- Update condition to check for active link deletion
- Add logic for total progress milestones to monitor for when teacher adds more lessons or quizes to class
- Change to check for course_type
- Add facility management link back to navbar (#478)
- Modify anonymous struct to correctly parse http response
- Resource mgmt detects when no changes happen
- Ensure video key updates and handle UI issues
- Prevent kiwix from downloading/uploading thumbnails if they exist
- Updating users wasn't working correctly and tooltips were clipped (#481)
- Add facility management link back to navbar
- Multiple imports from merge conflict broke build
- Add frontend validation to user creation form to allow spaces in names (#502)
- Github action to use bastion host

### 🚜 Refactor

- Removed remember me checkbox from login page
- Applied requested changes from PR#388
- Added 6th param to each call to db.GetCurrentUsers() to account for adding user role to the signature when refactoring form dual user mgt pages
- Fix more lints
- Start building ULIComponent
- Completed heroIcon component replacement on the resourcesManagement page
- Completed heroIcon component replacement on the studentManagement and AdminManagement  pages
- Completed heroIcon component replacement on the ProviderCard.tsx
- Completed heroIcon component replacement on the PageNav.tsx
- Removed nested components from the ResourceManagement.tsx (#500)

### 📚 Documentation

- Add changelog post refactor + git tag

### Build

- Fixed build process

## [0.0.2] - 2024-09-25

### 🚀 Features

- First remote
- Add github action for conventional commits
- Add github action for Go linting
- Add fontend app
- Add basic skeleton, begin to draft things
- Add first basic user handler
- Progress on users table + handlers
- /api/login endpoint, JWT working
- Authentication works, routes are protected
- Add useractivity middleware, include provider services middleware
- Add provider services, impl provider_user_mappings
- Make create user return temporary password
- Move directory structure around
- Add action to import users from kolibri with middleware
- Add git hook for format + linting pre-commit
- Add tests for user endpoint and seeders
- Run tests in github actions CI
- Dockerize app
- Add docker compose file, fixes
- Add logging methods
- Generalize provider service middleware to work with ID's
- Finish canvas import users
- Add programs, milestones, provider tests
- Fix dockerization
- Fix service to adjust to programs
- Add v2 frontend from other codebase
- Finish initial port of frontend
- More UI work porting over
- Ui fixes, continue port
- Add initial outcomes, fix foreign key issues
- Add activity
- Add activity to replace UserCourseActivity
- Add hydra to docker compose
- Add hydra and fix database tables
- Complete redesign of dashboard, new fonts, new colors
- Work on oidc client registration
- Setup static file serving in docker, prepare for deployments
- Oidc flow with hydra
- Oidc route, work on redirects, hydra
- Adds cards and card list to my courses page, random fixes on dashboard
- My progress page updated with mock data
- Add frontend/UI for auth client registration of providers
- Canvas middleware activities + milestones
- Init go workspace, move shared src code to root directory
- Add logrus structured logging, fix lints
- Get milestones for program user in middleware
- Module exports in middleware, register routes
- Adds course catalog page, updates course pills
- Changes format of course catalog list card
- Add canvas-seeder
- Add cron scheduling
- Add cron scheduling service
- Import programs from canvas
- User dashboard endpoint
- Rearrage codebase, remove jobs
- Fix user dashboard sql query for output
- Serve frontend in nginx container
- Prepare build script and compose files for many environments
- Move provider middleware into scratch container, in-memory sqlite db
- Add seeder, courseCatalogue endpoint, user favorites
- Dashboard endpoint and fix seeder
- Finish dashboard + catalogue issues
- Uses dashboard api and updates some variable names to match import
- Add Puppeteer student discussion posts to Canvas
- Add ory keto, refactoring, oidc work
- Add kratos identity mgmt to docker setup, endpoint for ui
- Organize config files and docker configuration
- Ory configuration mgmt
- More ory kratos configuration work
- Initial draft of our UI login to kratos, identity creation
- Finish ory auth + login with our UI
- Adds daily user activity api and integrates with frontend
- Updates entire my progress page and relevant backend requests, updates seeder for outcomes
- Adds description, modifies activity for dashboard, updates seeder for realistic words
- Adds outcome pills to catalog, filters dashboard, updates time
- Ui for provider user mangement
- Backend impl for provider user management
- Clean up middleware, remove bloat
- Make backend aware of client ory sess, fix auth route and cache sessions
- Work on user management UI, auth fixes
- Prov user mgmt, fix session/auth issues
- Implement modal to view imported provider users
- Adds facilities table & admin dashboard backend
- Implement filtering users by facility_id, and admin context switching
- Add tests for user endpoints and facility contexts
- Add gh action to build + push containers to ecr
- Add gh action to build + push containers to ecr
- Adds outline of admin dashboard, separates admin/student dash
- Adds facilities table & admin dashboard backend
- Adds admin dashboard UI & connects to backend
- Adds password ui validation
- Backend impl user search
- Add fetching singular oidc client info for ui
- Adds resources to right side bar
- Adds wikipedia card to open content
- *(266)* Create a general component for search
- *(266)* Create a general component for search
- Backend impl user search
- Add fetching singular oidc client info for ui
- Adds authorization info to revisit
- Backend impl user search
- Adds activity graph on student dash
- Add demo ci/cd github action
- *(267)* Add search and sort to My Courses
- Add open content, fix outstanding issues with courses
- Add db function to create outcome for progress milestones
- Catalogue search, search fixes, makefile
- Adds confirm bulk import modal, fixes modal types
- Add facility name form to init psw reset
- Finish openid connect implementation
- Prevent kratos from prompting user again for oauth2 login
- Kolibri sql integration and dockerization
- Kolibri integration work
- Prep kolibri for oidc. auto create users in sync'd instance
- Finish kolibri OIDC implementation
- Add rev proxy routing to other oauth2 routes
- User-activity page removal (#357)
- Add unauthorized page and protect routes
- *(268)* Add sort to MyProgress.tsx
- Add nats to base docker compose setup
- Add cron-tasks binary to publish jobs + refactor middleware to sub to MQ
- Add adjustible cron schedule env var and fix scheduling
- Add provider user search
- Switch to goose from gorm automigrate
- Add air and frontend container for hot reloading in docker
- Add collapsible navigation component
- Add unauthorized page and protect routes
- Updated course catalog pills w resp. design
- Impl api class to frontend to simplify components
- Simplify backend responses, remove in-house auth, fixes
- Add custom error type with method to handle error type
- Initial commit of custom error type with method to handle error type
- Initial commit of log fields struct wrapper with internal logging methods to use with HandleError method
- Add reflection to get handler name and change LogFields type to sLog type
- *(334)* Backend validation for frontend forms
- Add more fields to user validation and fix client err display
- Work in progress
- Merge preston main branch, implement tests for backend api, correct bug issues
- Cleanup code
- Removed unused files
- Removed unused files and uncomment out HTTP test scenario code
- New resources management ux
- Add custom error type with method to handle error type
- Add healthcheck endpoint, toggle provider active

### 🐛 Bug Fixes

- Move logs to proper directory, add .gitignore files
- Lint
- Create logfile if not found
- Remove commmited cookie-jar
- Error handling for lint
- More git hook errors
- Ci tests
- Complete dockerizing service/middleware
- Correct issue where server starts before PG
- Login issue where cookie wasn't being set properly
- Move .env.example to root directory
- Correct filepath to frontend public folder to host imgs
- Tests and lints
- Ui linting + formatting
- Remove build dir from git
- Login error with redirects
- Remove additional authcontext
- Lsp import errors from @/* imports
- Welcome page login issue
- Errors with fetching using SWR
- App env for development
- Cors issue
- Another cors issue
- Auth flow
- Correct login form error behavior keep it from throwing
- Remaining slog calls
- Remove duplicate table list for migrations
- Logging dependencies in middleware
- Logging in backend
- Changes fallback background to correct colors, fixes large pill on card view of course catalog
- Fixes catalog list card background and spacing
- .env.example for canvas-seeder
- Add separate .env.example for canvas-seeder
- Scheduling deadlock
- Correct programs importing from canvas
- Correct programs importing from canvas
- Lint error ci
- Tls error for deployment
- Oidc informatiion returned to the client
- Tls issue in scratch container
- Dashboard sql
- Add missing user dashboard field, dont return resource
- Remove debugging delay and non-headless mode
- If recent courses is empty, still keeps the correct sizing of cards
- Remove favorites field from milestones
- Add return after nil check for user pointer
- Add proxy and redirect if no login flow is started
- Fixes login issues, adds week activity to dashboard api
- Removes unused code on dashboard api
- Fixes pulled time back to seconds, removes extra lines of code
- Adds id to catalog return
- Removes soft deletes from user favorites
- Removes unused variables
- Fixes lint errors on latest push
- Adds files for build dev to work
- Activity errors, ci issues
- Docker compose file duplicate entry
- Actions caching and deduping users
- Auth issue where running in containers
- Work on middleware fixes
- Correct user importation behavior from providers
- Add warning to reset server if migrate fresh
- Logout issue with kratos redirect
- User activity page link, add tests, random fixes from PR
- Test action to build container and push
- Conditional builds for gh action
- Correct github action behavior
- Finally fix the github action
- Conditional builds for gh action
- Diff algo to determine cond. build
- Diff refs/remotes/main to fix conditional output
- Add some logging and retry github actions for ecr push
- This github action better work this time so help me god
- Github action test, will have to rebase + squash these commits
- For sure squashing these commits
- Finally fix the github action
- Finally fix the github action
- Kubectl config for staging deployments
- Condenses convertSeconds & rounds on admin dash
- Add ecr secret creation to k8s workflow, prettier formatting
- *(299)* Fix search, remove chevrons in activity and users pages
- Merges main to resolve merge conflicts
- Actually merges in branch :)
- Updates pills to take in text
- Add fields to oidc client info
- Fixes grid color in dark mode
- Remove open content unused import
- Kolibri username OOB error
- Corrects recent activities course_progress on student dash
- Kolibri user importation
- Remove yarnrc and other bloat
- Providerusermgmt keep users selected when page turns
- Prevent importing duplicate users providerusermgmt
- Is_public cast to bool when canvas can return nil
- Changes activity col
- Updates left menu to resources
- Homepage recent courses cards UI fixed
- Adds inner background css
- Colors on login with theme
- Adds provider platform name on prov user management
- Updates top milestones graph on admin dash
- Fixes stats card spacing & card overflow
- Adds content on no enrollments to student dash
- Student dash enrolled courses truncates alt name
- Filter by facility id when getting top programs for dash
- Empty recent programs for user-dashboard
- Small UI fixes for staging
- Returns overflow auto to cards & implementes overflow hidden on others
- Removes alt names from admin dash charts
- Fixes grid cols on student dash:
- Hardcodes facility name
- Fixes pagination not working on later pages on Users page
- Externally links to courses in list view
- Stop from refreshing page when incorrect psw
- Adds real kolibri link to resources
- Adds wiki deployment
- Fixes top courses final box on admin dash
- Adds warning message on reset password
- Resources page id's for proper deletion
- Order by even when not sorting catalogue
- Ensures all modal buttons are submit not submit query
- Fixes import users modal on dark mode
- Adjust npx husky command
- Fixes all linting warnings
- Submit button value
- Replace redirect to kratos when no flow is found in /login
- Validation error when creating preexisting username
- Fixes entire page re-render for course catalog, adds error rendering
- Remove unused import to fix container build
- Fixes mapping modal, updates pagination, updates seeder
- Changes seeder back
- Switch to justfiy-between for my progress css class
- Golangci-lint version to work with go 1.23
- Adjust provider readme for queue impl and fix env
- Return consistent kv pairs of users/programs in job params
- Correct incorrect check for nil error on a db.tx value
- Link to kolibri oidcauthenticate to oauth user automatically
- Unused imports
- Unused imports
- Frontend types, lints and seeder issue + update makefile
- Issue with consent page/oauth, seeder, retain build info
- Remove unused database methods
- Change else if's to switch
- Modify comment
- Correct activity page for failing ci despite unused
- Dockerfile to match new main.go location
- Attempt to migrate to new kratos schema in staging
- Force pass reset if traits are missing in kratos to recreate
- Correct login hanging on invalid credentials, refactor API class
- Fresh migrations nats authentication
- UseSWR hooks data undefined + optimize sql query, add env example
- Prevent kolibri from being returned to UI for user creation in pp
- Make login refresh trigger by changing return type of API call
- Code review modifications
- Frontend types, lints and seeder issue + update makefile
- Change docker-compose to docker compose in makefile
- Disallow kolibri user management
- Remove unused schedule field from task struct
- Tasks foreign key mixup
- Add provider id to runnable task insert in scheduler

### 🚜 Refactor

- Runs prettier on previously committed frontend files
- Move initLogging out of main, set log level
- Formatting and prettier
- Pull out error handling from server response
- Provider plaforms UI updated, pill change WIP
- Reduces code
- Prettier config file to prevent overlapping changes
- Removed commented code
- Replace anys with correct types
- Make server methods + handlers priv access
- Refactored resource cards & types

### 📚 Documentation

- Update readme to reflect build
- Add first changelog
- Add instuction for seeder in readme
- Add common issues to readme, fix provider middleware readme
- Add readme info about kolibri dockerization and development

### 🎨 Styling

- Dropped new facility name below form input and trimmed whitespace upon submit

### 🧪 Testing

- Temporarily rm backend tests till refactor is over

### ⚙️ Miscellaneous Tasks

- Fix working directory of go lint
- Merge folder canvas-discussion-bot into canvas-seeder
- Remove canvas-discussion-bot
- Adds prettier formatting file and formats all frontend files
- Add pull request template

<!-- generated by git-cliff -->
