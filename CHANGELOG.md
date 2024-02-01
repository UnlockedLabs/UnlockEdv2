# Changelog

All notable changes to this project will be documented in this file.

## [0.0.3] - 2024-02-01

[55b3166](55b3166de3f5a5ef3c25a418f3f2f36e3912cf9c)...[84e4484](84e448402544a7fcdc3d2efd4fe26318c2f17b99)

### Bug Fixes

-   Alter method to createMany() to fix seeding of test data ([99425d4](99425d4366ac9b2a9c1059d34c7e9d2ef8ad818c))
-   Give dashboard and users routes names ([1ee16ee](1ee16eee3a15eb7b24a29fe4a8ab3398880c8854))
-   Give dashboard and users routes names ([41be385](41be385da5ddb48766bf77e6314717d368777b41))
-   Update foreignId in enrollments ([582865a](582865a12dcac2f33cdf23e459643b1572022c9a))
-   Add key to pagination buttons ([d6f10a4](d6f10a4967e9b1759cf411b888d7cfc14a603b7b))
-   Add key to page nav ([600da66](600da66b9c611619fb86163fcfe549c457720f9d))
-   Missing field on typescript user model ([e77ede3](e77ede353465d5198da103632f058d8b1ed16b65))
-   Correct errors in canvas service ([6e5c007](6e5c0077238b56d37117202c42ac5609865e53f1))
-   Correct mistake in unneeded api_url ([c11b63d](c11b63de8b9de001ab3a7953edc8b36107de16b2))
-   Fix update enrollment request rules ([cf164e3](cf164e3adb07b2bd3c71a78f4407d4cdda461155))
-   Finish mapping controller and canvas services ([6a8120b](6a8120b4cdc4cf687de7a9b856d460533fd3d624))
-   Configure oidc library, fix user entity ([c98867a](c98867a8321d87867d34e42d70c3659a0698d29c))
-   Correct mistake in headers in canvas services client ([07f90ea](07f90ea57d688316ba970028b14f15a77e2b223b))
-   Progress in permanent auth solutions to access token 'sub' issues ([c3d8d39](c3d8d39a8d86de911d83edfff084198c09e8997d))
-   Progress in permanent auth solutions ([7806037](78060379e2a3b912ad81853be725d45f0e73ac13))
-   Clicking trash button deletes the correct link ([cdb532e](cdb532e61b9c019992151d3ab02450dabe6f0e5d))
-   Change field on usermapping to auth provider status ([2a8bca0](2a8bca01a96946e40a06b54fa78d6aa30c0c492e))
-   Fixes change in LeftMenu.tsx with Category interface ([db39b52](db39b5230396b3bf9814a861300915ad424e8463))
-   Remove hashAccessKey from Provider Platform UN-215 ([a33a1b9](a33a1b9ed5e8e490834a33d412fc397b1d785d9f))
-   Cast account_id type to int ([85e40f8](85e40f8c4f3e3e772c66c0a6da8496f3eb4f0aab))
-   Adapt tests to new api auth guard, and fix pointless chatGPT tests ([cfc04f5](cfc04f5aa8e49d6c54def00bed2fcf65565b6c90))
-   Remove unneeded request, create generic request for matching user ID ([6aa1874](6aa1874fd848e1102c17d9bee2568148ea211bcf))
-   Correct fields and make tests pass in enrollments ([2fa276a](2fa276a447f9b6faefc5ca448d2291df9ca0715f))
-   Add provider enrollment ID to model, move RPC's to actions and bugfixes ([84e4484](84e448402544a7fcdc3d2efd4fe26318c2f17b99))

### Documentation

-   Add debugging tools to README.md ([6ad7d2d](6ad7d2ddfde3745daf01b700b625e4dda63e1117))
-   Update changelog via git cliff ([503780b](503780b7bd5cfef2b29f266969c38a801ef09c45))
-   Add passport config info to readme ([97811db](97811dbad28adbad67dd6f1b3189eaa2511df26a))

### Features

-   Add git tags for repo init/first sprint and add first changelog.md ([7d1c280](7d1c2808e314e1f27b4aa1ba741919904ffab7f5))
-   Expose user role to api ([f964240](f9642403270032910ea07d544c538b0e4002c4ce))
-   Simplify UI ([0e4a42d](0e4a42daa0278b3c818caab6054015cf5005a8ff))
-   Fetch users with search, pagination, and sort ([453911a](453911a72378d90048201c62016bc082a9f05406))
-   UN-211 Courses Model and Migration ([6fa9c4e](6fa9c4e19d44d0445b602db54d5bada7b4142020))
-   Create enrollment model and migration ([b8b453e](b8b453e60f6048b94e8c9ac582d8ad656f65149a))
-   Remove links from pagination ([7c6e91c](7c6e91cfbf879b714bd889f94923354178ea202b))
-   Sketch out user management modals ([9b33ce1](9b33ce1ff517dc64cf3fe82866bda36e23ddfc05))
-   Render categories and links in the left menu ([7e95f29](7e95f2922a550a37e19dcf3f62ac1e5153eee3b5))
-   Pull category data from api ([721a7b8](721a7b89c7a79410175fa0f6b6ee28d8c54c3a0e))
-   Add enrollments crud api ([62be6be](62be6be9139aceeb890e3ca3a44f77e5ff69582c))
-   Add providerusermapping model and controller ([fe3146a](fe3146a10669729c5abdae22f6f2ffd61ae2d596))
-   Add migrations for provider user mapping ([ff471c6](ff471c68dc400edf4d205a4484b9b236fd41c5cb))
-   Add openidconnect library to complete oauth process and add migration for providerUserMapping ([98dfa94](98dfa9465934425ed52065298e86296d42a4746a))
-   Finish oidc auth setup for canvas provider integration ([ac22478](ac224784ed875a270b5250e19b200758ead6c032))
-   Creates left menu management page and displays categories & links ([84f4a34](84f4a3455872ce22991db426fdac130b3e177e33))
-   Add auth provider service to canvas services and fix request methods ([a2bf5f4](a2bf5f47b0fb389d6d025b90132f44e85cc179a2))
-   Add and delete links within a category ([72f4f9b](72f4f9ba549040450556ccc27ce5fe4d5e162b81))
-   Add course controller/model/factory Corey UN-210 ([f5f7936](f5f79360e05cad26412fc69f2e1c8165e5000cd3))
-   Add service to add unlocked as auth provider to canvas ([1cd885c](1cd885c139580213687bb7603a1c1ea142fafc4d))
-   Add canvas service to add unlocked as auth provider ([888e9af](888e9af8252049b49222bfcc8c8efa9b533b5dfd))
-   Add auth provider mapping model and basic controller for canvas service ([80c0cb4](80c0cb4629432933c4f2a561c14771ecc3c7bdd3))
-   Add provider user mapping, configure auth, migration for auth id ([84e7e04](84e7e04def00380fc6be15f34b89abb97862e0a0))
-   Create action/RPC for registering auth provider in canvas ([7739c6f](7739c6fdd7bf464d5dc89ac092444dba688c5219))
-   Create action/RPC for registering auth provider in canvas ([8b9cd26](8b9cd26cddbe5afeeeb5b7c99e17c49c6ab63b79))
-   Add user entities for auth configutation ([60341ae](60341aea4ce2b38a5baecfc8e949540ac9d94c9d))
-   Admin can add a new left menu category ([fdbee33](fdbee33b8a8558342e8d9f492bb1385b61fdcee5))
-   Admin can delete a category ([afc29e3](afc29e35821e176e50f35669b610755fcf2117a3))
-   Make provider_start_at and provider_end_at nullable in courses database UN-215 ([2249903](2249903b70dd559e0803c69a17f02cf89bc7e98a))
-   Add service to pull Canvas courses, display, and persist in v2 database UN-215 ([1838f74](1838f7415ee1eaaf5612ebfd2deb62f83b6248ce))
-   Add provider_user_id and provider_course_id to enrollments table UN-215 ([58a74ae](58a74aee2c691d2ef754a04b6792ac047e7045ab))
-   Pull course and enrollment data from Canvas and persist in UnlockEd v2 db UN-215 ([a17a2d2](a17a2d21f2fc28c5c15c3f89a57c66321d49c466))
-   Add auth middleware for api routes ([4f5259b](4f5259bb24efa6ddbddfb9dc05ac3692953d925b))
-   Add action for creating user login, guard api route ([01b3dea](01b3dea007886ed3eb46c3d457653063c1c96cea))
-   Add authorization on endpoints for users+admins at the request level ([566297f](566297fa05606b39eae42f7cc5598079d5e24c63))
-   Fix and finish tests for all controllers to include auth behavior at the request level ([3e0d231](3e0d23159f08c6478766b599e688b00ec0dca894))

### Miscellaneous Tasks

-   Remove sanctum and enable passport + clean dependency add basic configurations ([ca2d88f](ca2d88fbf15905558a989573c1b6b004a1fba6db))
-   Fix formatting on README.md ([c8cd1e8](c8cd1e82c3fdb41b380b1481cdf64576d032ee50))
-   Configure passport and set api routes for oauth ([fb1f469](fb1f4698b54a004d12c077ac06d16bbdeebf93a3))

### Refactor

-   Moves interface locations and properly calls hooks ([3e86f76](3e86f762b05460183dc4248d27bda5bf92300fed))
-   Cleanup canvasservices, remove boilerplate and fix header issues ([0ee52bf](0ee52bf85e8174a9f42faa15be9b721a620410e0))
-   Deletes unnecessary code ([fa9c7ec](fa9c7ec6eb76750b28792696a3dab222efbba2eb))

## [0.0.1] - 2023-12-18

[d02197d](d02197db2e99a50981c165c96da38baeba969990)...[55b3166](55b3166de3f5a5ef3c25a418f3f2f36e3912cf9c)

### Bug Fixes

-   Add workflow.md and fix sqlite config ([a7ff635](a7ff6350f522c2fe73a78a06c72697b951693527))
-   Skip checking typescript libs ([c16204e](c16204e23cb1150bcf621b2cd03bb20d8b54b610))
-   Merge conflict issues and properly migrate ([3c75631](3c75631b8ca9eee21f4c01876a958f5bcdb4921b))
-   Correct sqlite issue, fix migrations ([5067fac](5067facda925716b38986237bc8076e98fa15aaf))
-   Move name_first + name_last to proper down() migration fn ([f059f88](f059f88aa8b7336dddef885e35373dc9e2bf9b8c))
-   Make username field nullable for the CI ([3ed67ab](3ed67abe16b224bebcae4fd6d2c9bd161c74f4ea))
-   Remove sqlite db from git history + add to ci ([9127f21](9127f2129db45c0d67d99e35b9e2b68a56e9bb11))
-   Mistake in migration merge conflict ([6abcee5](6abcee5d4888f9c1ee06cfd59c827b48f31956fa))
-   Merge conflict error ([76d5174](76d5174402c49f4bbdfe7e8da885de58d034f18b))
-   Attempt to fix CI Vite build permissions ([26b9d0f](26b9d0f6532e05b7248c6f637406bb7dc933a38d))
-   Remove view methods from api user controller ([127149a](127149a2704d32616374a5044e9565a0c8321a25))
-   Change mistake in profile form to show last name ([5cf750d](5cf750d1b8bfde4856fc8413a9047dec660e2e6c))
-   Correct php -> sail ([ae385f3](ae385f344c137be5bf25db39e09ac37697977054))
-   Resolve testGetCategory not handing json well ([73611f9](73611f956062b6142e0706f6e701a3dc1c5915d8))
-   Updated CategoryControllerTest to handle CategoryRequest ([6011e0e](6011e0e041d009de9d5dcb5e8fb1230224845a59))
-   Correct test issue where protected field was being asserted in JSON structure ([0f7cc10](0f7cc104f3f93a8bf9292b897c2331654b9d5d74))
-   Correct merge conflict mistake in welcome.tsx ([cb366bb](cb366bb61ad9242eceab48785a87f6af39ab3ec7))
-   AuthenticatedLayout usage ([e50106a](e50106a8aa25a9fdd04faf9329ec5b97f5dd8516))
-   Remove incorrect lint from prettier gh action ([0684880](06848809bf005a046e5196947fd4d49069daf385))

### Documentation

-   Update README.md ([8404801](8404801f48c5320cd5006965c51b73b48f743569))
-   Add common problems to readme.md ([f4778ec](f4778ecc694c08b1f731e7ef6562471ea1cb5148))

### Features

-   Add testing + conventional commit workflow ([debee21](debee21c4b37e22915fcd34a5271ac4cd864deb1))
-   Add nextui and custom welcome page ([8d38a6a](8d38a6ae032f72557a53cbe48c302a52480f4b7c))
-   Change name on User to first + last, update tests and UI ([3424bd1](3424bd1ae3b668d44fd7ffbaab39662d0c3366ab))
-   Add role to user model and add migration ([b5fb6cf](b5fb6cf52b11419aa5c86f60e68ffa5ecf6fed86))
-   Add username to user model ([8782cb8](8782cb868fe4c2c1011eeba94b7d506bd1c1988c))
-   Complete addition of username to model and migrations ([879229e](879229e8e2083f1e63d9a847e0387c952ccd4277))
-   Add role to user model and add migration ([2615c0f](2615c0f1a9ff420622c4a2ee3e9f11e3e8f7b8db))
-   Complete addition of username to model and migrations ([ae9eaa4](ae9eaa4dbd241b75dcd17cf5288f217d0093d94a))
-   Added password_reset field to user model ([6555596](6555596a250b9f537fe3326a27805da6b9252c7b))
-   Add enums for ProviderPlatform UN-196 ([3d63619](3d6361951910f10780d72f84058d345810119731))
-   Add model/migration for Provider Platforms UN-182 ([1ac986f](1ac986fa81795284f6cd3d35687701d4336abc83))
-   Add dependabot to CI ([8933607](89336078b7fca207614b66b3cba6f35da81a93fb))
-   Add factory/seeder for Provider Platforms UN-197 ([5bbe64f](5bbe64fa064acc6bab007098e6dfb4b1d154e5bd))
-   Add requests + resources for user crud ([cc4b998](cc4b998bdf1420e4e59244b669ccf67045523b1f))
-   Add User crud operations w/ tests ([deded0e](deded0e1f4adb0600e1ec42602a9dc60e3ae8a00))
-   Add pagination + resource ([83e8898](83e889879684a047d43d1e64b26cdd48a0c84903))
-   Remove forgot pwd, change login to username, impl Auth flow ([c8bca72](c8bca728ea0619d21106f8325a407ab3b81dad50))
-   Edit resources + continued work on UN-144 ([a880c95](a880c954bb413ff328cc04a7264edd16c6b88bc1))
-   Add favicon logo for browser tab ([d1cedac](d1cedace3515f997a6abdab3e97b7e4a5798c9fa))
-   Continue work on UN-144 fix auth flow ([8b6a42a](8b6a42a5288a683c4371fce91d8a067da0c37a04))
-   Add searching and pagination ([d8629e7](d8629e77dae60e33eeaf3deac97e8ea31be8a0a7))
-   Add searching and pagination ([5f56ba6](5f56ba6031538e94c1063452548853f9398d24b9))
-   Add default SuperAdmin + seeder ([387d973](387d973473abb277427df20bb58d6d47d545087f))
-   Add git hook prettier check for unstaged formatting ([86ce39b](86ce39bd5ee2dad0429ed21130fc4c79e18b1f5d))
-   Add github actions for formatting ([bb09660](bb0966026b0c8867390b44621628efea8c56c064))
-   Add category api crud ([a76a5df](a76a5df28ebb4b2c56a8c03dd37f8f3e2673c930))
-   Change email to username on password reset table ([b035267](b035267ed11a99914f6083921fd99801f7625672))
-   Add Resource & Request for ProviderPlatform ([2060818](20608185e03c1e5086add8ec3a66a6ae9e3da8f5))
-   Add StoreProviderPlatformRequest ([a016c68](a016c6857be459d77213244a35538a8e2e3f5156))
-   Add hashing function for `access_key` ([76ebb03](76ebb034e1530ef4e78c4647d55ae8009bfebdfd))
-   Add CRUD (via Resource route) for ProviderPlatform ([d390a4b](d390a4b85ba0c172626f61f7dd8bc8087b40a658))
-   Add ProviderPlaform CRUD UN-183 ([e6a8318](e6a8318440d00ce46ac0d9e6d29f04508c5556f0))
-   Implement login flow that triggers reset for superadmin ([bd323e3](bd323e3a43beee5ce6b5c968221d707f934f05ed))
-   Add tests ([17bbac8](17bbac8fb3ecad79bbbab65ab0468443e3148aa7))
-   Add git cliff changelog to generate changelog.md for repo every other friday ([5ee4ceb](5ee4cebf26ec253ae2631d940ee7107271b3af0f))
-   Remove unnecessary pages + controller for auth, remove register option from homepage ([a238d7f](a238d7ff329b6dd61c8a4d36a13b174e3e47370a))
-   Add oxlint linting system for frontend code to githook ([ea4d78d](ea4d78d6af6176e438648c1c125d3c79ee6dea7b))
-   Add left menu component ([e32263e](e32263e82643441df8b9e627ba386549565c8804))
-   Add temporary user management page ([fc5bf20](fc5bf200869511e2bf2781d7a2b878a773feda90))
-   Add oxlint linting system for frontend code to githook ([416c349](416c3491e1b464538f6036963b7eedfea6412151))
-   Migrate useful canvas api calls/service from starfish ([5085e12](5085e12934bb983c9855f450b82533b26ec5abd3))
-   Mock out user management UI ([2cb6ada](2cb6adaace42de5be4034beefdceab928295df6d))
-   Add oxlint linting system for frontend code to githook ([55b3166](55b3166de3f5a5ef3c25a418f3f2f36e3912cf9c))

### Miscellaneous Tasks

-   Add linting and pre-commit hooks ([7829d0c](7829d0c4ff58ba62f89262ec06fcf8ea8b912f77))
-   Fix prettier setup ([0f0974e](0f0974e7227d0f5f36a6d50bd0ba1747dff72d75))
-   Fix merge conflicts ([3cbadd3](3cbadd3487e449e1b179aa36b7fc90ef06335680))
-   Add categories seeder ([543623e](543623e58d1eeac4d62d20b7b423fb746c50c5e5))
-   Move linter to its own action to make it easier to determine failures. add docs for commits ([4d8c205](4d8c205d26434fce4febf1c92cf42d4e90cac4d1))
-   Move linter to its own action to make it easier to determine failures. add docs for commits ([60af875](60af875d598e9e5235f5d4e2e59f66a5ae523f09))
-   Add swr lib: React Hooks for Data Fetching ([77a5bfb](77a5bfbdeed8282851d3c956d553b83fe8f37229))

### Refactor

-   Add laravel pint for style and formatting, first run ([4bad522](4bad5225e89a51f1211f1d48eeab1def502f0098))
-   Style code via laravel pint ([e73b790](e73b79024c6a07d1968906d9ab21948f55e906b5))
-   Clean up github actions yml files ([dc2081a](dc2081a7292332841129a6d7f6196566fe5e3aea))

### Testing

-   Add updateUser test + fix password hashing ([12ec22a](12ec22a8f445ea35647c0b38ea8bed85ff06681f))

## [0.0.01a] - 2023-11-28

### Miscellaneous Tasks

-   Init ([d02197d](d02197db2e99a50981c165c96da38baeba969990))

<!-- generated by git-cliff -->
