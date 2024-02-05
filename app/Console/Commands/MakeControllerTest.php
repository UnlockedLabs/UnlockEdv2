<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

class MakeControllerTest extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:make-controller-test {name}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Command description';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $controllerName = $this->argument('name');
        $this->alert("Please make sure you have a factory setup properly with the typical naming convention,
            and setup properly in the TestSeeder.php class. If the route has user access, the factory must have a forUser()
             method that creates a model with the user_id field of a specific user'");

        $modelName = $this->ask('What is the name of the model?');
        $route = $this->ask('What is the route for the controller?(always use `id` for dynamic routes: e.g. api/v1/users/id/logins)');
        $protected = $this->choice('Is this a Admin only resource?', ['admin access only', 'user can access']);
        $isDynamicRoute = false;
        if ($protected === 'admin access only') {
            $this->info('Tests will assert failed status for non-admin users');
            $testContent = $this->generateTestContentAdmin($controllerName, $modelName, $route, $isDynamicRoute);
        } else {
            $this->info('Tests will assert users can access their own data at the resource, but cannot create or delete');
            $testContent = $this->generateTestContent($controllerName, $modelName, $route);
        }

        $filePath = base_path("tests/Feature/{$controllerName}GeneratedTest.php");

        File::put($filePath, $testContent);

        $this->info("Generated feature test for controller: {$controllerName}");
    }

    private function generateTestContent($controllerName, $modelName, $route)
    {
        $class = "\App\Models\\{$modelName}";
        $resource = App::make($class);
        $modelTable = $resource->getTable();
        $columns = Schema::getColumnListing($modelTable);
        $className = "{$controllerName}Test";
        $model = ucfirst($modelName);
        $seederField = "public \$seeder = \Database\Seeders\TestSeeder::class;";
        $routeField = 'public string $url = '."'$route';";
        $jsonScheme = [];
        foreach ($columns as $column) {
            $jsonScheme[] = "'$column'";
        }
        $fieldsList = implode(",\n", $jsonScheme);
        $singleJsonStructure = <<<TAG
        public  \$single_json_structure = [
            'data' => [
                 $fieldsList
            ]
        ];
        TAG;
        $arrayJsonStructure = <<<TAG
            public  \$array_json_structure = [
                'data' => [
                '*' => [
                $fieldsList
                ],
                ],
            ];
         TAG;
        $fileHeader = <<<TEXT
        <?php
            namespace Tests\Feature;
            use App\Models\\{$model};
            use Database\Seeders\TestSeeder;
            use Illuminate\Foundation\Testing\RefreshDatabase;
            use Tests\TestCase;

        class {$className} extends TestCase
        {
            use RefreshDatabase;
            $routeField
            $seederField
            $singleJsonStructure
            $arrayJsonStructure


            /* You may need to edit these tests to match the actual behavior of the controller
            * this is just a template and a good starting point, be sure to test for any edge cases
            * and any other behavior that is not covered here
            */
            public function testAdminCanAccess{$modelName}()
            {
                \$this->seed(\$this->seeder);
                \$admin = \App\Models\User::factory()->admin()->createOne();
                \$response = \$this->actingAs(\$admin)->get(\$this->url);
                \$response->assertStatus(200);
                \$response->assertJsonStructure(\$this->array_json_structure);
            }

            public function testUserCanAccess{$modelName}()
            {
                // seed to assert there is more than 3 records in the database
                \$this->seed(\$this->seeder);
                // create a regular user
                \$user = \App\Models\User::factory()->createOne();
                // create 3 records for the user
                {$model}::factory(3)->forUser(\$user->id)->create();
                // assert that the user can access the resource
                \$response = \$this->actingAs(\$user)->get(\$this->url);
                \$response->assertStatus(200);
                // assert that the response contains only the 3 records for the user
                \$response->assertJsonCount(3, 'data');
                foreach (\$response->json('data') as \$record) {
                    // assert that only the users data is returned
                    \$this->assertEquals(\$user->id, \$record['user_id']);
                }
            }

            public function testAdminCanCreate{$modelName}()
            {
                \$this->seed(\$this->seeder);
                \$admin = \App\Models\User::factory()->admin()->createOne();
                \$model = {$model}::factory()->makeOne();
                \$response = \$this->actingAs(\$admin)->postJson(\$this->url, \$model->toArray());
                \$response->assertStatus(201);
                \$response->assertJsonStructure(\$this->single_json_structure);
            }

            public function testProtectedCreate{$modelName}()
            {
                \$this->seed(\$this->seeder);
                \$user = \App\Models\User::factory()->createOne();
                \$model = {$model}::factory()->makeOne();
                \$response = \$this->actingAs(\$user)->postJson(\$this->url, \$model->toArray());
                \$response->assertStatus(403);
            }

            public function testAdminCanUpdate{$modelName}()
            {
                \$this->seed(\$this->seeder);
                \$admin = \App\Models\User::factory()->admin()->createOne();
                \$model = {$model}::factory()->createOne();
                \$response = \$this->actingAs(\$admin)->patchJson(\$this->url . '/' . \$model->id, \$model->toArray());
                \$response->assertStatus(200);
                \$response->assertJsonStructure(\$this->single_json_structure);
            }

            public function testProtectedUpdate{$modelName}()
            {
                \$this->seed(\$this->seeder);
                \$user = \App\Models\User::factory()->createOne();
                \$model = {$model}::factory()->createOne();
                \$response = \$this->actingAs(\$user)->patch(\$this->url . '/' . \$model->id, \$model->toArray());
                \$response->assertStatus(403);
            }

            public function testAdminCanDelete{$modelName}()
            {
                \$this->seed(\$this->seeder);
                \$admin = \App\Models\User::factory()->admin()->createOne();
                \$model = {$model}::factory()->createOne();
                \$response = \$this->actingAs(\$admin)->delete(\$this->url . '/' . \$model->id);
                \$response->assertStatus(204);
            }

            public function testProtectedDelete{$modelName}()
            {
                \$this->seed(\$this->seeder);
                \$user = \App\Models\User::factory()->createOne();
                \$model = {$model}::factory()->createOne();
                \$response = \$this->actingAs(\$user)->delete(\$this->url . '/' . \$model->id);
                \$response->assertStatus(403);
            }
        }
        TEXT;

        return $fileHeader;
    }

    private function generateTestContentAdmin($controllerName, $modelName, $route)
    {
        $class = "\App\Models\\{$modelName}";
        $resource = App::make($class);
        $modelTable = $resource->getTable();
        $columns = Schema::getColumnListing($modelTable);
        $className = "{$controllerName}Test";
        $model = ucfirst($modelName);
        $seederField = 'public $seeder = TestSeeder::class;';
        $routeField = 'public string $url = '."'$route';";
        $jsonScheme = [];
        foreach ($columns as $column) {
            $jsonScheme[] = "'$column'";
        }
        $fieldsList = implode(",\n", $jsonScheme);
        $singleJsonStructure = <<<TAG
        public  \$single_json_structure = [
            'data' => [
                 $fieldsList
            ]
        ];
        TAG;
        $arrayJsonStructure = <<<TAG
            public  \$array_json_structure = [
                'data' => [
                '*' => [
                $fieldsList
                ],
                ],
            ];
         TAG;
        $fileHeader = <<<TEXT
        <?php
        namespace Tests\Feature;

        use Database\Seeders\TestSeeder;
        use App\Models\\{$model};
        use Illuminate\Foundation\Testing\RefreshDatabase;
        use Tests\TestCase;

        class {$className} extends TestCase
        {

            use RefreshDatabase;
            $routeField
            $seederField
            $singleJsonStructure
            $arrayJsonStructure


            /* You may need to edit these tests to match the actual behavior of the controller
            * this is just a template and a good starting point, be sure to test for any edge cases
            * and any other behavior that is not covered here
            */
            public function testAdminCanAccess{$modelName}()
            {
                \$this->seed(\$this->seeder);
                \$admin = \App\Models\User::factory()->admin()->createOne();
                \$response = \$this->actingAs(\$admin)->get(\$this->url);
                \$response->assertStatus(200);
                \$response->assertJsonStructure(\$this->array_json_structure);
            }

            public function testProtected{$modelName}()
            {
                \$this->seed(\$this->seeder);
                \$user = \App\Models\User::factory()->createOne();
                \$response = \$this->actingAs(\$user)->get(\$this->url);
                \$response->assertStatus(403);
            }

            public function testAdminCanCreate{$modelName}()
            {
                \$this->seed(\$this->seeder);
                \$admin = \App\Models\User::factory()->admin()->createOne();
                \$model = {$model}::factory()->makeOne();
                \$response = \$this->actingAs(\$admin)->postJson(\$this->url, \$model->toArray());
                \$response->assertStatus(201);
                \$response->assertJsonStructure(\$this->single_json_structure);
            }

            public function testProtectedCreate{$modelName}()
            {
                \$this->seed(\$this->seeder);
                \$user = \App\Models\User::factory()->createOne();
                \$model = {$model}::factory()->makeOne();
                \$response = \$this->actingAs(\$user)->postJson(\$this->url, \$model->toArray());
                \$response->assertStatus(403);
            }

            public function testAdminCanUpdate{$modelName}()
            {
                \$this->seed(\$this->seeder);
                \$admin = \App\Models\User::factory()->admin()->createOne();
                \$model = {$model}::factory()->createOne();
                \$response = \$this->actingAs(\$admin)->patch(\$this->url . '/' . \$model->id, \$model->toArray());
                \$response->assertStatus(200);
                \$response->assertJsonStructure(\$this->single_json_structure);
            }

            public function testProtectedUpdate{$modelName}()
            {
                \$this->seed(\$this->seeder);
                \$user = \App\Models\User::factory()->createOne();
                \$model = {$model}::factory()->createOne();
                \$response = \$this->actingAs(\$user)->patchJson(\$this->url . '/' . \$model->id, \$model->toArray());
                \$response->assertStatus(403);
            }

            public function testAdminCanDelete{$modelName}()
            {
                \$this->seed(\$this->seeder);
                \$admin = \App\Models\User::factory()->admin()->createOne();
                \$model = {$model}::factory()->createOne();
                \$response = \$this->actingAs(\$admin)->delete(\$this->url . '/' . \$model->id);
                \$response->assertStatus(204);
            }

            public function testProtectedDelete{$modelName}()
            {
                \$this->seed(\$this->seeder);
                \$user = \App\Models\User::factory()->createOne();
                \$model = {$model}::factory()->createOne();
                \$response = \$this->actingAs(\$user)->delete(\$this->url . '/' . \$model->id);
                \$response->assertStatus(403);
            }
        }
        TEXT;

        return $fileHeader;
    }
}
