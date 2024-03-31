<?php

namespace App\Services;

/**
 * Class KolibriServices
 */
class KolibriServices extends ProviderServices
{
    public function __construct(int $provider_id, int $account_id, string $base_url, string $access_key): void
    {
        return parent::__construct($provider_id, $account_id, $base_url, $access_key);
    }

    /**
     * @param: int channel_id
     *
     * @param: int content_id
     *
     * @info request specific content
     *
     * @example localhost:8000/api/content/<channel_id>/contentnode/<content_id>
     */
    public function requestSpecificContent($channel_id, $content_id)
    {
        $url = $this->base_url."content/{$channel_id}/contentnode/{$content_id}";

        return $this->GET($url);
    }

    /**
     * @param: $channel_id
     *
     * @param: $search_words
     *
     * @info search content
     *
     * @example localhost:8000/api/content/<channel_id>/contentnode/?search=<search words>
     */
    public function searchContent(int $channel_id, array $search_words)
    {
        $url = $this->base_url."content/{$channel_id}/contentnode/?search={$search_words}";

        return $this->GET($url);
    }

    /**
     * @param: $channel_id
     *
     * @param: $content_id
     *
     * @param: $fields
     *
     * @info  request specific content with specified fields
     *
     * @example localhost:8000/api/content/<channel_id>/contentnode/<content_id>/?fields=pk,title,kind
     */
    public function requestSpecificContentWithFields(int $channel_id, int $content_id, array $fields)
    {
        $url = $this->base_url."content/{$channel_id}/contentnode/{$content_id}/?fields={$fields}";

        return $this->GET($url);
    }

    /**
     * @param: $channel_id
     *
     * @param: $page
     *
     * @param: $page_size
     *
     * @info request paginated contents
     *
     * @example localhost:8000/api/content/<channel_id>/contentnode/?page=6&page_size=10
     */
    public function requestPaginatedContents(int $channel_id, int $page, int $page_size)
    {
        $url = $this->base_url."content/{$channel_id}/contentnode/?page={$page}&page_size={$page_size}";

        return $this->GET($url);
    }

    /**
     *  @param: $channel_id
     *
     *  @param: $fields
     *
     *  @param: $page
     *
     *  @param: $page_size
     *
     *  @param: $search
     *  request combines different usages
     *  localhost:8000/api/content/<channel_id>/contentnode/?fields=pk,title,kind,instance_id,description,files&page=6&page_size=10&search=wh
     **/
    public function combinedRequest(int $channel_id, array $fields, int $page, int $page_size, string $search)
    {
        $url = $this->base_url."content/{$channel_id}/contentnode/?fields={$fields}&page={$page}&page_size={$page_size}&search={$search}";

        return $this->GET($url);
    }
}
