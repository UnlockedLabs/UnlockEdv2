import { User } from '@/types';
import { formatDate, formatRelativeTime } from '@/lib/formatters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    Edit,
    KeyRound,
    MoreVertical,
    UserX,
    Users,
    Trash2
} from 'lucide-react';

interface ResidentHeaderProps {
    user: User;
    facilityName: string;
    joinedDate: string;
    lastActiveDate: string;
    isDeactivated: boolean;
    isDeptAdmin: boolean;
    onEditProfile: () => void;
    onResetPassword: () => void;
    onDeactivate: () => void;
    onTransfer: () => void;
    onDelete: () => void;
}

export function ResidentHeader({
    user,
    facilityName,
    joinedDate,
    lastActiveDate,
    isDeactivated,
    isDeptAdmin,
    onEditProfile,
    onResetPassword,
    onDeactivate,
    onTransfer,
    onDelete
}: ResidentHeaderProps) {
    const statusLabel = isDeactivated ? 'Inactive' : 'Active';

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-[#203622]">
                            {user.name_first} {user.name_last}
                        </h1>
                        {statusLabel === 'Active' ? (
                            <Badge className="bg-green-100 text-green-800 border-green-300">
                                Active
                            </Badge>
                        ) : (
                            <Badge
                                variant="outline"
                                className="bg-gray-100 text-gray-700 border-gray-300"
                            >
                                Inactive
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>
                            <span className="text-gray-500">Username:</span>{' '}
                            <span className="font-medium">
                                {user.username}
                            </span>
                        </span>
                        <span>•</span>
                        <span>{user.doc_id ?? 'N/A'}</span>
                        <span>•</span>
                        <span>Created {formatDate(joinedDate)}</span>
                        <span>•</span>
                        <span>
                            Last active {formatRelativeTime(lastActiveDate)}
                        </span>
                    </div>
                    {facilityName && (
                        <div className="mt-2 text-sm text-gray-600">
                            <span className="font-medium">
                                Current Facility:
                            </span>{' '}
                            {facilityName}
                        </div>
                    )}
                </div>

                {!isDeactivated && (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onEditProfile}
                        >
                            <Edit className="size-4 mr-2" />
                            Edit Profile
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onResetPassword}
                        >
                            <KeyRound className="size-4 mr-2" />
                            Reset Password
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <MoreVertical className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onClick={onDeactivate}
                                    className="text-orange-600"
                                >
                                    <UserX className="size-4 mr-2" />
                                    Deactivate Account
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {isDeptAdmin && (
                                    <>
                                        <DropdownMenuItem onClick={onTransfer}>
                                            <Users className="size-4 mr-2" />
                                            Transfer Resident
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </>
                                )}
                                <DropdownMenuItem
                                    onClick={onDelete}
                                    className="text-red-600"
                                >
                                    <Trash2 className="size-4 mr-2" />
                                    Delete Resident
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>
        </div>
    );
}
