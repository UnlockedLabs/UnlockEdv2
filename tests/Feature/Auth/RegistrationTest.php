<?php

use App\Models\User;
use App\Providers\RouteServiceProvider;

test('registration screen can be rendered', function () {
    $response = $this->get('/register');

    $response->assertStatus(200);
});

test('new users can register', function () {
    $newUser = User::factory()->makeOne();
    $data = [
        'name_first' => $newUser->name_first,
        'name_last' => $newUser->name_last,
        'email' => $newUser->email,
        'password' => hash('md5', 'password'),
        'password_confirmation' => hash('md5', 'password'),
    ];
    $response = $this->post('/register', $data);

    $this->assertAuthenticated();
    $response->assertRedirect(RouteServiceProvider::HOME);
});
