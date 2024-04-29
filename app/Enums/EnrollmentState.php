<?php

declare(strict_types=1);

namespace App\Enums;

enum EnrollmentState: string
{
    case ACTIVE = 'active';
    case INACTIVE = 'inactive';
    // case INVITED = 'invited';
    case COMPLETED = 'completed';
    case DELETED = 'deleted';

    public static function toArray(): array
    {
        return array_column(EnrollmentState::cases(), 'value');
    }
}
