<?php

namespace App\Enums;

enum AuthProviderType: string
{
    case OPENID_CONNECT = 'openid_connect';

    case OAUTH = 'oauth';
}
