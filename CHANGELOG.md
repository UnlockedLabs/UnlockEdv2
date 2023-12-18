# Changelog

All notable changes to this project will be documented in this file.

## [0.0.1] - 2023-12-18

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
-   Add oxlint linting system for frontend code to githook ([55b3166](55b3166de3f5a5ef3c25a418f3f2f36e3912cf9c))

### Miscellaneous Tasks

-   Add linting and pre-commit hooks ([7829d0c](7829d0c4ff58ba62f89262ec06fcf8ea8b912f77))
-   Fix prettier setup ([0f0974e](0f0974e7227d0f5f36a6d50bd0ba1747dff72d75))
-   Fix merge conflicts ([3cbadd3](3cbadd3487e449e1b179aa36b7fc90ef06335680))
-   Add categories seeder ([543623e](543623e58d1eeac4d62d20b7b423fb746c50c5e5))
-   Move linter to its own action to make it easier to determine failures. add docs for commits ([4d8c205](4d8c205d26434fce4febf1c92cf42d4e90cac4d1))
-   Move linter to its own action to make it easier to determine failures. add docs for commits ([60af875](60af875d598e9e5235f5d4e2e59f66a5ae523f09))

### Refactor

-   Add laravel pint for style and formatting, first run ([4bad522](4bad5225e89a51f1211f1d48eeab1def502f0098))
-   Style code via laravel pint ([e73b790](e73b79024c6a07d1968906d9ab21948f55e906b5))
-   Clean up github actions yml files ([dc2081a](dc2081a7292332841129a6d7f6196566fe5e3aea))

### Testing

-   Add updateUser test + fix password hashing ([12ec22a](12ec22a8f445ea35647c0b38ea8bed85ff06681f))

<!-- generated by git-cliff -->
