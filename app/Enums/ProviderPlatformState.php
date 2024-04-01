<?php

declare(strict_types=1);

namespace App\Enums;

enum ProviderPlatformState: string
{
    case ENABLED = 'enabled';
    case DISABLED = 'disabled';
    case ARCHIVED = 'archived';
}
