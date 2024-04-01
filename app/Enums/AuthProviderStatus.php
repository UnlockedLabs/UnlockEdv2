<?php

declare(strict_types=1);

namespace App\Enums;

enum AuthProviderStatus: string
{
    case OPENID_CONNECT = 'openid_connect';

    case OAUTH = 'oauth';

    case NONE = 'none';
}
