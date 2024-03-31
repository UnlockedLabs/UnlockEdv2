<?php

namespace App\Enums;

enum ProviderPlatformType: string
{
    case CANVAS_CLOUD = 'canvas_cloud';
    case CANVAS_OSS = 'canvas_oss';
    case KOLIBRI = 'kolibri';
}
