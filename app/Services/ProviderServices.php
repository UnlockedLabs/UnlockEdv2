<?php

declare(strict_types=1);

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Illuminate\Support\Facades\Crypt;
use Psr\Http\Message\ResponseInterface;

/**
 * Class ProviderServices
 */
class ProviderServices
{
    /**
     * @var string
     * @var string
     * @var Client
     */
    protected int $provider_id;

    protected string|int $account_id;

    protected string $access_key;

    protected string $base_url;

    protected Client $client;

    protected function __construct(int $provider_id, $account_id, string $api_key, string $url)
    {
        $parsed_url = parse_url($url);
        if (! isset($parsed_url['scheme'])) {
            $url = 'https://'.$url;
        }

        if ($account_id === '0' || $account_id === null) {
            $account_id = '1';
        }

        $this->provider_id = $provider_id;
        $this->account_id = $account_id;
        try {
            $this->access_key = Crypt::decryptString($api_key);
        } catch (\Illuminate\Contracts\Encryption\DecryptException $e) {
            $this->access_key = $api_key;
        }
        $this->base_url = $url;
        $this->client = new Client();
    }

    public function getAccountId(): string
    {
        return $this->account_id;
    }

    public function getAccessKey(): string
    {
        return $this->access_key;
    }

    public function getBaseUrl(): string
    {
        return $this->base_url;
    }

    protected static function handleResponse(ResponseInterface $response): mixed
    {
        if ($response->getStatusCode() === 200 || $response->getStatusCode() === 201 || $response->getStatusCode() === 204) {
            return json_decode($response->getBody()->getContents(), true);
        } else {
            throw new \Exception('API request failed with status code: '.$response->getStatusCode());
        }
    }

    protected function GET(string $url): mixed
    {
        try {
            $response = $this->client->request(
                'GET',
                $url,
            );
        } catch (RequestException $e) {
            throw new \Exception('API_ERROR '.$e->getMessage());
        }

        return self::handleResponse($response);
    }

    /**
     * @info POST request
     *
     * @throws \Exception
     **/
    protected function POST(string $url, array $body): mixed
    {
        try {
            $response = $this->client->request(
                'POST',
                $url,
                ['form_params' => $body]
            );
        } catch (RequestException $e) {
            throw new \Exception('API_ERROR '.$e->getMessage());
        }

        return self::handleResponse($response);
    }

    /**
     * @info PUT request
     */
    protected function PUT(string $url, array $body): mixed
    {
        try {
            $response = $this->client->request(
                'PUT',
                $url,
                ['form_params' => $body]
            );
        } catch (RequestException $e) {
            throw new \Exception('API_ERROR '.$e->getMessage());
        }

        return self::handleResponse($response);
    }

    protected function DELETE(string $url): mixed
    {
        try {
            $response = $this->client->request('DELETE', $url);
        } catch (RequestException $e) {
            throw new \Exception('API_ERROR '.$e->getMessage());
        }

        return self::handleResponse($response);
    }

    /**
     * Adds a trailing slash if none exists.
     *
     * @param  string  $id  Account or user ID
     * @return string Formatted account or user ID
     **/
    protected static function fmtUrl(string $id): string
    {
        if (! is_string($id)) {
            $id = strval($id);
        }
        if (! str_ends_with($id, '/')) {
            return $id.'/';
        }

        return $id;
    }
}
