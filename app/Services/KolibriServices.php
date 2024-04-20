<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Class KolibriServices
 */
class KolibriServices extends ProviderServices
{
    public function __construct(int $provider_id, int $account_id, string $base_url, string $access_key)
    {
        parent::__construct($provider_id, $account_id, $base_url, $access_key);
    }

    /**
     * @info request specific content
     *
     * example localhost:8000/api/content/<channel_id>/contentnode/<content_id>
     */
    public function requestSpecificContent(int $channel_id, int $content_id): mixed
    {
        $url = $this->base_url."content/{$channel_id}/contentnode/{$content_id}";

        return $this->GET($url);
    }

    /**
     * @info search content
     *
     * example localhost:8000/api/content/<channel_id>/contentnode/?search=<search words>
     */
    public function searchContent(int $channel_id, array $search_words): mixed
    {
        $joined = implode(',', $search_words);
        $url = $this->base_url."content/{$channel_id}/contentnode/?search=$joined";

        return $this->GET($url);
    }

    /**
     * @info  request specific content with specified fields
     *
     * example localhost:8000/api/content/<channel_id>/contentnode/<content_id>/?fields=pk,title,kind
     */
    public function requestSpecificContentWithFields(int $channel_id, int $content_id, array $fields): mixed
    {
        $fields = implode(',', $fields);
        $url = $this->base_url."content/$channel_id/contentnode/$content_id/?fields=$fields";

        return $this->GET($url);
    }

    /**
     * @info request paginated contents
     *
     * @example localhost:8000/api/content/<channel_id>/contentnode/?page=6&page_size=10
     */
    public function requestPaginatedContents(int $channel_id, int $page, int $page_size): mixed
    {
        $url = $this->base_url."content/{$channel_id}/contentnode/?page={$page}&page_size={$page_size}";

        return $this->GET($url);
    }

    /**
     * @param  $search
     *                 request combines different usages
     *                 localhost:8000/api/content/<channel_id>/contentnode/?fields=pk,title,kind,instance_id,description,files&page=6&page_size=10&search=wh
     **/
    public function combinedRequest(int $channel_id, array $fields, int $page, int $page_size, string $search): mixed
    {
        $fields = implode(',', $fields);
        $url = $this->base_url."content/$channel_id/contentnode/?fields=$fields&page=$page&page_size=$page_size&search=$search";

        return $this->GET($url);
    }
}
