# Changelog

All notable changes to this project will be documented in this file.

## [0.0.7] - 2024-03-29

[5afc0b9](5afc0b992fc6e30cf10dbc54334fbde033ec7dfc)...[d4f6634](d4f663430318dcf93027479799596834fdd177cb)

### Bug Fixes

-   Only insert provider if env var is set ([230b0f2](230b0f2ae946902b72d06d97fa0e1b1daff67636))
-   Adds modal component back in ([cb9e96a](cb9e96ac0db419b90fde91ab56e603f9b9c9c1a6))
-   Fix title so that it says 'UnlockEdv2' instead of 'Laravel' ([063f35d](063f35ddd287fe109e5a03f176e7a60422b2ffc6))
-   Fix pagination chevrons to be disabled when they are in an unusable state ([5172cc3](5172cc356c739e7dff70a889e7654cdebce0b9a3))
-   Implement PR review suggestions ([2a9dda5](2a9dda5f06aa542b66e9b5bc953d26c7db313c98))
-   Implement PR review suggestions ([911cb34](911cb345a16eb10aa7a556b53d3165e3669a4c96))
-   Decrease lines in getQuartileScore ([c215bc7](c215bc792784b71303e4c714441b82cc8880813f))
-   Locally host fonts instead of use Google ([796132c](796132c85473b911b886d3be4a0432b89741c484))
-   Adds ref to delete category modal ([fdd0016](fdd00168aff4746d4289f6feb5f1dab772e0dad9))
-   Shows specific error message for no links ([a7134cc](a7134cce4078cc45272b3549070ec3bd4d488f79))
-   Add generic components from @calisio, finish user mgmt ([65e13ad](65e13ad58ed4f87303736a6477523e70e6df03b1))
-   Finish implementing generic components in user mgmt ([f2bd806](f2bd806344b0c0c0ea4add9313d8420ff59a8c45))
-   Add closex to adduser form ([5582eb7](5582eb75c9a7180c0942e8e0088191bdc339167b))
-   Changes user management forms to use general input components ([b1ac1eb](b1ac1eb95233c7e53508ef1b235532e648bcd9c3))
-   Cleans up user password reset modals ([3af20ee](3af20ee7b6d368d0fcdf200fc023121a2199e338))
-   Minor changes from usermgmt pr ([d4b5dfa](d4b5dfa3bc239fbeeaa2b1aeba70bb876f26e1bc))
-   Add proxy to middleware for SSL termination ([26a3e62](26a3e62c35dcf013ab1e76e0e44b3b178a8a36dc))
-   Try to correct provider behavior w/ access_key on remote deployments ([06e1ba2](06e1ba2d0d9148c289b3180b932b6a805127626e))
-   Assorted server issues ([a7ad66e](a7ad66e6633b68c3bad605364a1961e1ed391170))
-   Default to root account in canvas services instance ([9e23308](9e233086473e5f8f88d248c8311da558e8ecc1fc))
-   Default to root account in canvas services instance ([a40fa04](a40fa04ad1a90730065bb86d6839e010dd0b6bbd))
-   Add demo branch to github actions workflow ([4c50b57](4c50b570ab5d67a76d882199c8bc02cdeb4c8563))
-   Adjust nvm use for deployments and CI ([64ba52b](64ba52b764ad0d2c5cce482fc333a25d19cda400))
-   Create generic userauth request for users to access their own resources ([c69c006](c69c006cc3568ff883a06faf5ee9571ac6ad83fb))
-   Fix increased contrast of timeline titles on welcome page ([34dcba6](34dcba6efd967fe1a402743a24459e7196cfce5a))
-   Fix logo style to act like svg image, not selectable text block ([35bdf1b](35bdf1b6ba052cedbe9fd4070f44779eee7e71f6))
-   Add validate params and remove overrideAuthorize ([1115140](111514068f6e12f89949ef5df2ca15b37ec31f67))
-   Remove recursive creation of provider platforms in seeding test data ([bb491bb](bb491bb54d5730bd41143fa736721279d9164a34))
-   Tests for new proper seeding method ([8138e03](8138e03a34ec2968691a70cd3db7757466fdc49a))
-   Correct more seeder/factory behavior for better mock data in staging ([e827a5b](e827a5bcc2b5a219afde2a7a9ce48ff34f8ff98d))
-   User acitivity test to reflect new seeder ([e406da9](e406da96020b6d85909f530c9077c1dd00ca674e))
-   Fix theme toggle indicator being invisible when it is clicked on ([7371fda](7371fda35dfe76d6db31f238563116d99bb5759e))
-   Fixes invalid use of hooks in edit user form ([afc577d](afc577d3a03f310b3ac7be8101ddbfaf02775fcc))
-   Shows correct temp password modal depending on edit or add user ([6c4ea74](6c4ea74f47f088a1201fa4585229c88bb13dc47d))
-   Fixed toast states in left menu management and adds toasts to provider platforms ([68b305f](68b305f7a37e52520275b4826898160af8c65fb8))
-   Correct more seeder/factory behavior for better mock data in staging ([65bed5d](65bed5dc6327fa3093cb63565c24bd104803ed02))
-   User acitivity test to reflect new seeder ([745564a](745564af928ae25800062cf93993d9692595a3cb))
-   Re add staged changes after git hook ([a6a05e7](a6a05e72a739c91bb23a0d33f705bafabe6a8290))
-   Remove check for staged files since githook is fixed ([2723104](2723104c2e1dfb7a1aafa3825dacacfef1b713ad))
-   Fixes input imports ([229f5ff](229f5fff135d6eb31d09b6e9d1da60f5dc71cd6f))
-   Fixes input imports ([7a19e7e](7a19e7e3a3db34f760edc411ff3ba0c1261c8171))

### Documentation

-   Add + edit readme, license and contrib.md ([e8abdbc](e8abdbca8015bb21737dfab808aef1e6c90e9211))
-   Creates contributing.md file ([be36b86](be36b86ab4481f47f2f7131bbcdce028858fcc24))

### Features

-   Add user activity map ([9370e95](9370e955f9186739e21aba6721368dea1589566c))
-   Creates submit button component and fixes all forms ([ac93646](ac936461bfe46432a232a24f29ec0386be1d6134))
-   Add demo auto deployment ([164526c](164526c899fa9a86d46b16ba3f3c30d62469a30f))
-   Add start_date and end_date parameters for UserActivityMap ([4120d7d](4120d7d8a200f528ab8674230988d79aedf6057f))
-   Add start_date and end_date parameters for UserActivityMap ([8a1efa8](8a1efa85887fb39d853e5de65f149d8ccdf805a8))
-   Add progressive loading to the large image in Welcome ([cf2a7a6](cf2a7a61358bd0823902fa9b59cf41e520f0c70d))
-   Close menu dropdown when clicking outside of it ([b460c4d](b460c4deb2e9356c73f8d228cfe687e50bffa641))

### Miscellaneous Tasks

-   Add changelog for sprint 17 ([8b32b1f](8b32b1fe11153010a7cccbf5cf26c5d209caeec0))
-   Test Jira issue review transition automation ([cd4c51e](cd4c51e3dcf69a25ff834da9b276aca055040988))
-   Update issue templates ([24208de](24208ded15f754e13a659eaebe5a19d56b2445db))

### Refactor

-   Adds components for add category form and add link form ([8ca64fa](8ca64faeca8a04f8830d51ac2bd0b798964920d4))
-   Creates modal and toast components and separates components into different files for left menu management. adds tooltips to link items ([696098c](696098ce1665929ed1726e39a90746312997e896))
-   Toast waits to ease out ([32af32d](32af32d6d94a7c3a2c709eb274e1fb13267ac4e2))
-   Creates form components, first pass at condensing forms for provider platforms ([f85dbd8](f85dbd8e85da402eda1c017c23d168c6a9a4ae25))
-   General modal component fixed, keeps separate forms ([07ab523](07ab52386561d5efa7ccd27303f6269f651d9522))
-   Merges main into generalizing ui components ([acc5f9b](acc5f9b7324a98ee38716ada026f9f235fd8a012))
-   Changes file name of TextInput ([0b51612](0b51612b44e2f76a8f5192fdf5de89961f228f24))
-   Removes duplicate input folder ([ffaa57d](ffaa57db60c7c07b432f68d980d0fed3021d279b))
-   Condenses imports for forms ([989b60b](989b60b3dbe6c825bdb9d218c13e63c2096c36d8))
-   Prevent large format changes to unnecessary files ([d4f6634](d4f663430318dcf93027479799596834fdd177cb))

## [0.0.6] - 2024-03-19

[f5337d5](f5337d537c0e9fd3313d631ae44670362f4c1ee6)...[5afc0b9](5afc0b992fc6e30cf10dbc54334fbde033ec7dfc)

### Bug Fixes

-   Removed test line of code from docker-compose.yml ([4bc7282](4bc72826cc9adca9738d17050d8eae0cf27a88e4))
-   Change sort query parameter ([b7b31c9](b7b31c94e16898b235701690bf38597e4d35d787))
-   Alter deployment script for push to main ([37f08cc](37f08cce0b5fa4c1220545ac69bd99a024ffca90))
-   Pagination should use the last_page instead of total ([80eba44](80eba44ad77a4eb3b65287b9b3c9b0884030aa7a))
-   Change enrollments resource to add original fields, correct providerplatform routes ([803faf3](803faf3665a51ae85155379dda453558939ff876))
-   Use the correct case for student role in tests ([85e27df](85e27dfe21fb242e0877c520a26a8bda704195ed))
-   Fix pagination ([6433461](6433461664f839875cf6f8bd35af818881bc3da6))
-   Uses new database join to only pull enrollments for info ([1d7082a](1d7082a03d9f194a43e7a87f05ce02dfb0f599d5))
-   Change enrollments resource to add original fields, correct providerplatform routes ([fd2386c](fd2386c8c7787cc3762a05b528c7938a7fbcfa31))
-   Remove deploy script from repo ([627dc1f](627dc1fd59e5dfaf9f38c195bc5f1b2781092af8))
-   Displays user's name rather than their ID ([801f06e](801f06e5213742b1cf1c46c731fd1ed985e30aa5))
-   Correct factory/testing behavior for enrollments and resources ([37be78e](37be78e2a18a37990c74abee24527192b715c003))
-   Make controller return temp password ([b0a0d83](b0a0d835f1af8192854e4ccf57ad8e89d98d431a))
-   Adds fields to activity and removes unused imports ([76cf9e8](76cf9e8f1607c09d1fb1347f19d4896b0db37d7d))
-   Add store user temp password ([fe8b76e](fe8b76e23e5547c7d4b2405f4fd8f4cfb81bd3e2))
-   Correct behavior of storing user and temporary password ([325dcb6](325dcb660d148635e65669c89238b7ea63b6c646))
-   Change enrollments resource to add original fields, correct providerplatform routes ([cf60ab1](cf60ab152810936d0af550d421bb8ce87ffb5a3d))
-   Uses new database join to only pull enrollments for info ([cc88a83](cc88a8302f94963386d8792eda98cfea11e51d59))
-   Use the correct case for student role in tests ([d72450f](d72450fd93489473df7dae225222a189e057e56f))
-   Fix pagination ([f710df2](f710df279961105846e832cc01613eebffc36bda))
-   Change enrollments resource to add original fields, correct providerplatform routes ([243866f](243866fdcfd0e7ca4a09c3557b27a11337917515))
-   Remove deploy script from repo ([9eb6f91](9eb6f91eeb85f1a0b14ba84d848e0fc3fde958f1))
-   Correct factory/testing behavior for enrollments and resources ([0aba46c](0aba46c9728f1c755e42dacc425c144256ad6841))
-   Displays user's name rather than their ID ([93cd274](93cd274d6e31fef650912e6c3229735a9a86a4f6))
-   Adds fields to activity and removes unused imports ([b320edf](b320edf2713ebe6059ed86ea04ed2a90d431d1e3))
-   Change white text to neutral so it works with both themes ([5fd2529](5fd25294c86fe3ebe9143b8bfa50797eaace418e))
-   Move default seeder behavior to proper location ([6715f23](6715f2397295e7807d0f1c867a9137de7f6ed101))
-   Major corrections in courses and enrollments tables, add env parsing for test data ([b2d02a4](b2d02a4b2c6f302238d1d597a4ddda4d3649de8d))
-   Change frontend to reflect new field in course content ([b4d2fc0](b4d2fc0160f2e97369f48b4c79c539f69f81001d))
-   Remote tests sql error ([030199d](030199d95be889cf9243c4b2d3840388ac4c7b6c))
-   Add route for all-courses rpc ([5c5b365](5c5b3656dfb07792fa6fa90a9dd8b69e68d56d5a))
-   Namespace error in courses action route ([b69bfc9](b69bfc9835c65740a1ac49b1f21460de61684fd1))
-   Add img_url to user course action ([07e286f](07e286f363491d09a1d3eeca2d59dd26e195c82c))
-   Correct testing, seeding + factory behavior ([14cfdca](14cfdca4655f7522e2cafc345ea2ddeb1f1d2d56))
-   Correct internal function calling behavior in canvas service for user id's ([508a6bb](508a6bb96e2bf65ec35026da84adf82a7cb9cd5f))
-   Correct/update actions behavior to work properly in canvas ([58dc0ce](58dc0cea581f09f0d470ffa8bc87922eb0bd4c20))
-   Finish fixing actions, all of them working properly ([9b167e4](9b167e476e2f7e387553f88d9637fd42a7035463))
-   Alter course description in case of null value ([a4d927a](a4d927add91ee261be22dc56f7713fa1037f72be))
-   Make login button visible ([f6b49d3](f6b49d3985397920be1d300cad397092516af08c))
-   Correct spelling mistake and change behavior for single usermap ([a6197fe](a6197fe8f8131f89dea7e8c9dd988952be06b103))
-   Change course description and image array key names to match Canvas ([b666bbd](b666bbdc186c88713deafad73c4378c07414342a))
-   Implement user activity search by user_name ([1594bf6](1594bf6b9e4bf6d2ea58b3ad5232a41e93f8cd91))
-   Remove pagination from Provider Platforms index ([c62956e](c62956e6d72dc68756885cdf8fcebf15407be370))
-   Fix user-activity failed to load users ([37c20d9](37c20d9191a67456aaf8e7d1d83759cc85058f45))
-   Add migration dedicated to modifying provider platforms table ([aeea616](aeea6163a260a7a3524e570fe90af2267f4fc7f1))
-   Add check to import canvas users ([19a72c2](19a72c2251f4692acb812e56f3eab4f6d9de8d65))
-   Change providerplatform method to not lookup twice ([2a8a3e8](2a8a3e82343c76ff801a87338528f0f617fb56e6))
-   Workflow for testing env variable ([0868a1b](0868a1bfd07d30acc1f9ecb7d2d164befe3edb7b))
-   Skip tests in ci environment, to be ran on staging env only ([41a6167](41a6167967d51bfd417a754e07a533f9fe2d696d))
-   Handle properly clearing user form ([2c3889f](2c3889fbddc57f334677d5547c0e0da2196617de))
-   Correct providerplatform request behavior, attempt to fix user role ([28f5df3](28f5df3cab406687afb6a9fb9896f4eb582d36c2))
-   Alter provider platform request to pass tests ([18a1956](18a1956282a0af635417d3c616165bec559ce2e3))
-   Changes access key UI to show hide with eye and eyeslash icon ([4ca5113](4ca5113350cfc2aad493f687f751aac8fd0f61b3))
-   Remove time function in argument to scheduler ([5afc0b9](5afc0b992fc6e30cf10dbc54334fbde033ec7dfc))

### Documentation

-   Add changelog, remove changelog action ([709a2bf](709a2bfb57eb276e455329217c12d4a0d24ea22f))

### Features

-   Pulls course info and provider info from the database ([1f04898](1f04898ba98145b7cc5a30f5d845f42e45ffebac))
-   Add description column to courses table ([ba65689](ba65689809d95c46a757ad02295ef25bcd954e1f))
-   Add auto deploy github action ([d0b0970](d0b09701c5783b9d61aa985911183ddccff91c3a))
-   Adds new user activity page ([56546a7](56546a7f8d4fea3b6e13ed63ebe3a8c3d2c21e86))
-   Adds description to each course card ([5bee499](5bee49922ddf0cbc9bcaec5b458798c9dc7b5bb2))
-   Add fields to the enrollments for the front end ([dd345f1](dd345f1fa8a69a242924a836a051f7e3a01335bc))
-   Add resource fields and table relations for front-end ([00c18e8](00c18e87e20a9aaa94a56e570c83250a7c79ef57))
-   Add user form ([2d622ed](2d622ed22b5c25169de726cb860bd9b9ea44937d))
-   Remove old add user form ([ec1b1fc](ec1b1fcf4b741878d1dbeabe6bd58ec5804bc8db))
-   Add edit user form ([f68bc55](f68bc552e9cdfdebb64658aaa2b46954fc381a32))
-   Better theme toggle ([74f752a](74f752a9161351e20167e6bcf371e52799851d3a))
-   Update to left menu management for consistency ([738c635](738c6357ced1e6510efae723bf254c03883e4f41))
-   Clean and consistency for the demo ([7a2d8b8](7a2d8b8a03a89857857316b46974fb1395a5d05f))
-   Add fields to the enrollments for the front end ([e9ab75a](e9ab75a0cd2c684e89c88cee39e5acb38145f67d))
-   Add resource fields and table relations for front-end ([ca6d04e](ca6d04ec6acdb24fb9da4934507a6991cd034408))
-   Add fields to the enrollments for the front end ([eade29e](eade29e4d9bb270a6570272e8b5c21e69f89d3e4))
-   Add resource fields and table relations for front-end ([7d27f12](7d27f12bfa95c61653500ebbc8d42945d94c099e))
-   Add user form ([990ae7b](990ae7b5edfac25fcf822afdd54daa4f72224915))
-   Remove old add user form ([4650606](465060682fc7c81e0b6407e01dd665ebb6bcef49))
-   Add edit user form ([f4da6fc](f4da6fcb5199a90015238f747400248f87bb31bb))
-   Better theme toggle ([dc2ec21](dc2ec217d516fe24fcbc4ede7efd6b4f5cf98c62))
-   Update to left menu management for consistency ([616cbd5](616cbd5a9f4a823a09ec404540f5f2ae8a1c5c75))
-   Clean and consistency for the demo ([b078396](b078396f667b18c7c0b6131b474a7e8eb90fbe96))
-   Add resource fields and table relations for front-end ([c852729](c8527290ea3670ba2d39fcc2c485a09321606fc6))
-   Opens left menu links in a new tab ([e0a50a3](e0a50a3f97da8de081117507c1dfaef52b58ef11))
-   Adds new user activity page ([6f4cca3](6f4cca310c1f59a8661b5ea70f3f0c6996817547))
-   Add dynamic user seeding from .env file ([b9195f8](b9195f87ecd6d89f2462cf2ce6f0f25fcf53348c))
-   Correctly saves the order of categories on save in left menu management ([e5b6d4b](e5b6d4b2eac9a17e68effedf1389f73807e1d712))
-   Adds URL and also adds the course image ([47f85bb](47f85bb5f9ba454e95bdf8a0b91cd339b17f9d6b))
-   Major fixes, cleanup and correct behavior, tests, add action for provider courses ([8ebc794](8ebc794c2173bcbf0a19175cdd74bcaa919e5782))
-   Properly migrate tables, remove duplicated fields, fix seeder + actions ([c632bac](c632bacfa95bbc567056723f42f1815af120d2d4))
-   Add useractivity relation to user model ([e6a6ed5](e6a6ed512dbfeecdf6ed42e94b302910e2640c46))
-   Complete cleanup fix actions, add field to user mapping ([5937fc2](5937fc29b42d54fd01e477b457901b17a32821e3))
-   Update welcome screen timeline ([d186069](d186069b750557a5ba864f3e7442d149fd5ce51d))
-   Adds provider platform page UN-184, UN-160, UN-161, UN-162 ([83d5a35](83d5a350e947cfe09fc11d2d79206a3005501390))
-   Begin adding integration tests ([06eaabd](06eaabdf14883433d2ce7488172fee2035784dd9))
-   Add integration tests and storing users from canvas ([4a2f59e](4a2f59ee8dff697de33848a6dd05650b4decb767))
-   Finish beginning integration tests + storing canvas users ([61a80e1](61a80e1e449283af26290bd52478a9b2ff01057d))
-   Add user course activity for cole's data activity display, add tests + job ([d6d4682](d6d46827b5408833eb1f637ba7f4132337a90c45))
-   Add scheduled cron job to retrieve user data ([5a54814](5a54814a686a3b3f121ad7533e3c26e452be5909))
-   Complete protection of provider keys ([851ea35](851ea35148e14e7e158147c62dd8e58f6de37951))
-   Make front end show/hide access key to match back-end behavior ([4d739fa](4d739fa139e8f9464cf35857d5ae2732d0307c28))
-   Add functionality to reset password and delete user buttons and fix: add user modal close and edit user reset values issues ([eb1e5ea](eb1e5eaff9e7f62232b382692b80d2b75ee22bd0))

## [0.0.5] - 2024-02-29

[0f35d93](0f35d933ba29adcd2e54194325c12a7baf3c7b2f)...[f5337d5](f5337d537c0e9fd3313d631ae44670362f4c1ee6)

### Bug Fixes

-   Remove assertion causing windows test failure ([d331ec2](d331ec24314beecc36c1bc568ccdb418ca9b0fe3))
-   Correct behavior of canvasservice/action for creation of user logins ([cdbe727](cdbe7277b755f263069ef5a67fe141f93b9205ba))
-   Add update state to left menu management ([15501ca](15501cac57a6d877878e6f83eb52f622094acce3))
-   Correct CourseSeeder class name ([50fb0ef](50fb0ef7362440f9b200de3059ff3f7d8e66876e))
-   Add logging config to sail dev environment ([1b4b2ec](1b4b2ec16176eb94d5f088638dc2fa5914a02977))
-   Modify enrollment seeder to correlate with FKs ([bd9165b](bd9165b219e32504d5d9b9a571ff789863899d3f))
-   Modify enrollment factory to correlate with user, platform, and course FKs ([7036a2d](7036a2d90574926a0e25546ddad88b804ea0ca41))
-   Correct seeder and canvas services createUserLogin, add delete authprovider ([f5337d5](f5337d537c0e9fd3313d631ae44670362f4c1ee6))

### Features

-   Add user activity middleware ([f91a70e](f91a70e24924514762e84c294bb254cc0ae81488))
-   Allow admin to change the order of links and when editing a link categoryList updates ([d545143](d54514308c8758f61c9e8bce03293e5673f44072))
-   Saves categories to backend, adds useMemo to left menu ([312b4ba](312b4ba727c5fe760ca0c99b13620adbfbfbcce1))
-   Add dynamic user seeding from .env file ([870994c](870994cf121c1c5c7d71633b02c1d786e0f3e89c))
-   Add provider user mapping to env variable seeding ([14f01bc](14f01bcd36f5420f06ec99fef32b36b191b218df))
-   Adds courses UI onto dashboard with hardcoded data ([fbea33b](fbea33becaf005762fb3fa694f9f75a48977d6e6))

### Refactor

-   Removes comments and imports on leftmenumanagement ([5e54ba2](5e54ba2ac3f7f2a97c2544d43f2b85bbb2b99b90))
-   Udpate category controller to match behavior of lefthand menu ([6e8a4e3](6e8a4e33aa0ae1a8f96b3d773f6996452abb3c10))

### Testing

-   Add authorization test to category controller ([c3a15db](c3a15dbea04577e2d5740d5b6464866e704bbbc7))

## [0.0.4] - 2024-02-13

[84e4484](84e448402544a7fcdc3d2efd4fe26318c2f17b99)...[0f35d93](0f35d933ba29adcd2e54194325c12a7baf3c7b2f)

### Bug Fixes

-   Updates categoryList with each link modification ([04a69ad](04a69ad0fbc91aff67e4b2ad7d576090f01c5f84))
-   Memoization fixes constant category list rerender ([86b938c](86b938cd896b209d9d6050a9734877602d9f76ef))
-   Deletes category based on id rather than rank ([aacf012](aacf012f452d55cfa2e4e3c5473f64bdb639fed8))
-   Updates LeftMenu to take in id and uses Category type ([65623a0](65623a070902384744cf10150de5498410402e17))
-   Add scope middleware that merge conflict removed ([31306fc](31306fcc7b1dffcf767e926638f1199655818644))
-   If user does not drop category in drop zone, will show it in list again at same place ([21b9c8b](21b9c8bbec769244306e59caf72d644262d46467))
-   Formatting issues ([402349e](402349ecfd45d638966f0e0ce0399ba2949f9aad))
-   Formatting issues with previous commit ([63f5964](63f596462bc4d5e4836378bc86d59daa8ab93bb6))
-   Remove generated duplicate tests for enrollments ([c1e21eb](c1e21ebfa2cba09a3aa2dc52b664d35ba0e4d7fb))
-   Add ability to create UserActivity for specific user ([c1789bb](c1789bba256f203df521f316940c674bef0bf913))
-   Handle user activity ip nullable ([247073f](247073f40916c3f72750d8f0722baf91163c2fb1))
-   Correct testing behavior discovered through useractivity pr ([7afab80](7afab8042b5dec7eb04a13a968bdf50413efd00b))

### Documentation

-   Add changelog for sprint 14 ([fb1b5d4](fb1b5d42282b682b0c97323a221f0af167cbe20b))
-   Add canvas authentication and oidc documentation ([d7600ff](d7600ff1b3caa380f7074eb7bf292554a31da6c2))
-   Add canvas authentication and oidc documentation ([d56ca0e](d56ca0eb119998eb3a574a0b18b6dfe5f56f6a64))

### Features

-   Add controller test generation command rough draft ([a8c4d9a](a8c4d9a8dfd5c801a21fc5b4c66a90ebc3f033d3))
-   Finish first implementation of dynamic controller test generation ([8286183](82861836198ea47232022dcaf3455d0db02511cf))
-   Introduces draggable categories and rearranges them correctly (bug when categories are not collapsed) ([214e0e1](214e0e1570598b6ff1d692f719346f3fb062ac21))
-   Adapts draggable to switch components correctly, needs animations still ([e6c7837](e6c783793ba4cfaec0b26e98af89738ea4673254))
-   Hides dragged item on drag, adds padding on elements where moving category to ([c416998](c4169986c711cdb2bef22f606e4afa3f90895387))
-   Add logout button to menu and remove register button ([f2bfb19](f2bfb194dd2503a59d3e77028d7f0fdd1421dc6e))
-   Add canvas mocking json response for actions testing ([1cb3f18](1cb3f18c72c84c8f3c4bc9fd8856452d825066cb))
-   Add user activity model and migrations ([cf24594](cf245944ffaaec9cc4e52cadb12264373e48a533))
-   Add user activity CRUD api ([dabceb2](dabceb2b2725302206a291037e57abb62c592a8c))

### Refactor

-   Removes unneccesary imports from left menu management ([58e22fe](58e22febdd263c8c12d5cd007b9c8d93d918344c))
-   Removes todo ([ec1c060](ec1c060233f0a7c7348da807c751174dd085dc09))

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
