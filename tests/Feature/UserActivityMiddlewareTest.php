<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class UserActivityMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    public function testUserActivityIsLogged()
    {
        $testUrl = 'http://127.0.0.1:8000/dashboard';
        $userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3';

        // Create a mock user
        $user = User::factory()->create();

        // Authenticate the user
        $this->actingAs($user);

        // Set up a normal request with User-Agent header and IP
        $response = $this->get($testUrl, ['User-Agent' => $userAgent]);

        // Assert that the UserActivity was logged in the database
        $this->assertDatabaseHas('user_activities', [
            'user_id' => $user->id,
            'browser_name' => 'Chrome',
            'platform' => 'Windows',
            'device' => 'Desktop',
            'ip' => '127.0.0.1',
            'clicked_url' => $testUrl,
        ]);
    }

    public function testUserActivityIsLoggedForAllEndpoints()
    {
        $userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3';

        // Create a mock user
        $user = User::factory()->create();

        // Authenticate the user
        $this->actingAs($user);

        // Get all registered web routes
        $routes = Route::getRoutes()->getRoutesByMethod()['GET'];

        // Loop through each route and perform the assertions
        foreach ($routes as $route) {
            // Get the URI of the route
            $uri = $route->uri();
            // Set up a normal request with User-Agent header and IP
            $response = $this->get(url($uri), ['User-Agent' => $userAgent]);

            // Assert that the UserActivity was logged in the database
            $this->assertDatabaseHas('user_activities', [
                'user_id' => $user->id,
                'browser_name' => 'Chrome',
                'platform' => 'Windows',
                'device' => 'Desktop',
                'ip' => '127.0.0.1',
                'clicked_url' => url($uri),
            ]);
        }
    }

    public function testUserActivityParsesDifferentUserAgents()
    {
        $testUrl = 'http://127.0.0.1:8000/dashboard';
        $user_agents = [
            [
                'user_agent' => '',
                'browser' => 'Other',
                'device' => 'Desktop',
                'platform' => 'Unknown',
            ],
            [
                'user_agent' => 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/37.0.2062.94 Chrome/37.0.2062.94 Safari/537.36',
                'browser' => 'Chrome',
                'device' => 'Desktop',
                'platform' => 'Linux',
            ],
            [
                'user_agent' => 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36',
                'browser' => 'Chrome',
                'device' => 'Desktop',
                'platform' => 'Windows',
            ],
            [
                'user_agent' => 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko',
                'browser' => 'Other',
                'device' => 'Desktop',
                'platform' => 'Windows',
            ],
            [
                'user_agent' => 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.0',
                'browser' => 'Firefox',
                'device' => 'Desktop',
                'platform' => 'Windows',
            ],
            [
                'user_agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/600.8.9 (KHTML, like Gecko) Version/8.0.8 Safari/600.8.9',
                'browser' => 'Other',
                'device' => 'Desktop',
                'platform' => 'Mac',
            ],
            [
                'user_agent' => 'Mozilla/5.0 (iPad; CPU OS 8_4_1 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12H321 Safari/600.1.4',
                'browser' => 'Other',
                'device' => 'Mobile',
                'platform' => 'iOS',
            ],
            [
                'user_agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36',
                'browser' => 'Chrome',
                'device' => 'Desktop',
                'platform' => 'Mac',
            ],
            [
                'user_agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:40.0) Gecko/20100101 Firefox/40.0',
                'browser' => 'Firefox',
                'device' => 'Desktop',
                'platform' => 'Mac',
            ],
            [
                'user_agent' => 'Mozilla/5.0 (X11; CrOS x86_64 7077.134.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.156 Safari/537.36',
                'browser' => 'Chrome',
                'device' => 'Desktop',
                'platform' => 'X11',
            ],
            [
                'user_agent' => 'Mozilla/5.0 (Linux; U; Android 4.0.3; en-us; KFTT Build/IML74K) AppleWebKit/537.36 (KHTML, like Gecko) Silk/3.68 like Chrome/39.0.2171.93 Safari/537.36',
                'browser' => 'Chrome',
                'device' => 'Mobile',
                'platform' => 'Android',
            ],
            [
                'user_agent' => 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:40.0) Gecko/20100101 Firefox/40.0',
                'browser' => 'Firefox',
                'device' => 'Desktop',
                'platform' => 'Linux',
            ],
            [
                'user_agent' => 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/534.34 (KHTML, like Gecko) Qt/4.8.5 Safari/534.34',
                'browser' => 'Other',
                'device' => 'Desktop',
                'platform' => 'Linux',
            ],
            [
                'user_agent' => 'Mozilla/5.0 (Android; Tablet; rv:40.0) Gecko/40.0 Firefox/40.0',
                'browser' => 'Firefox',
                'device' => 'Mobile',
                'platform' => 'Android',
            ],
            [
                'user_agent' => 'Mozilla/5.0 (PlayStation 4 2.57) AppleWebKit/537.73 (KHTML, like Gecko)',
                'browser' => 'Other',
                'device' => 'Desktop',
                'platform' => 'Unknown',
            ],
            [
                'user_agent' => 'Mozilla/5.0 (Windows Phone 8.1; ARM; Trident/7.0; Touch; rv:11.0; IEMobile/11.0; NOKIA; Lumia 635) like Gecko',
                'browser' => 'Other',
                'device' => 'Mobile',
                'platform' => 'Windows',
            ],
            [
                'user_agent' => 'Mozilla/5.0 AppleWebKit/999.0 (KHTML, like Gecko) Chrome/99.0 Safari/999.0',
                'browser' => 'Chrome',
                'device' => 'Desktop',
                'platform' => 'Unknown',
            ],
            [
                'user_agent' => 'Mozilla/5.0 (X11; OpenBSD amd64; rv:28.0) Gecko/20100101 Firefox/28.0',
                'browser' => 'Firefox',
                'device' => 'Desktop',
                'platform' => 'X11',
            ],
        ];

        // Create a mock user
        $user = User::factory()->create();

        // Authenticate the user
        $this->actingAs($user);

        foreach ($user_agents as $agent) {
            // Set up a normal request with User-Agent header and IP
            $response = $this->get($testUrl, ['User-Agent' => $agent['user_agent']]);

            // Assert that the UserActivity was logged in the database
            $this->assertDatabaseHas('user_activities', [
                'user_id' => $user->id,
                'browser_name' => $agent['browser'],
                'platform' => $agent['platform'],
                'device' => $agent['device'],
                'ip' => '127.0.0.1',
                'clicked_url' => $testUrl,
            ]);
        }
    }
}
