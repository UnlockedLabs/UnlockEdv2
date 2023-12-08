<?php

namespace App\Enums;

enum ProviderPlatformState: string
{
    case ENABLED = 'enabled';
    case DISABLED = 'disabled';
    case ARCHIVED = 'archived';
}
