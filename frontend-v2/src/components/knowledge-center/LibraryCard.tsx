import { useState, MouseEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Star, StarOff, Flag, FlagOff, Search } from 'lucide-react';
import { Library, ToastState, UserRole, ViewType } from '@/types';
import { useAuth, isAdministrator, AdminRoles } from '@/auth/useAuth';
import { useToast } from '@/contexts/ToastContext';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import API from '@/api/api';

interface LibraryCardProps {
    library: Library;
    mutate?: () => void;
    role: UserRole;
    onSearchClick?: () => void;
    view?: ViewType;
}

export default function LibraryCard({
    library,
    mutate,
    role,
    onSearchClick,
    view = ViewType.Grid
}: LibraryCardProps) {
    const { toaster } = useToast();
    const [visible, setVisible] = useState(library.visibility_status);
    const [favorite, setFavorite] = useState(library.is_favorited);
    const navigate = useNavigate();
    const { user } = useAuth();
    const route = useLocation();
    const isAdmin = AdminRoles.includes(role);

    const adminWithStudentView = (): boolean => {
        return !route.pathname.includes('management') && isAdministrator(user);
    };

    async function handleToggleAction(
        action: 'favorite' | 'toggle',
        e?: MouseEvent
    ) {
        if (!mutate) return;
        if (e) e.stopPropagation();
        if (adminWithStudentView()) {
            toaster(
                "You're in preview mode. Changes cannot be made.",
                ToastState.null
            );
            return;
        }
        const actionString =
            action === 'favorite'
                ? favorite
                    ? role === UserRole.Student
                        ? 'unfavorited'
                        : 'unfeatured'
                    : role === UserRole.Student
                      ? 'favorited'
                      : 'featured'
                : visible
                  ? 'is now hidden'
                  : 'is now visible';
        const resp = await API.put<null, object>(
            `libraries/${library.id}/${action}`,
            {}
        );
        if (resp.success) {
            mutate();
            toaster(`Library ${actionString}`, ToastState.success);
            if (action === 'favorite') setFavorite(!favorite);
            else setVisible(!visible);
        } else {
            toaster(`Library ${actionString}`, ToastState.error);
        }
    }

    const handleSearchClick = (e?: MouseEvent) => {
        if (e) e.stopPropagation();
        onSearchClick?.();
    };

    const FavoriteIcon = () => {
        if (isAdmin) {
            return favorite ? (
                <Flag className="size-5 text-[#F1B51C]" />
            ) : (
                <FlagOff className="size-5" />
            );
        }
        return favorite ? (
            <Star className="size-5 fill-[#F1B51C] text-[#F1B51C]" />
        ) : (
            <StarOff className="size-5" />
        );
    };

    if (view === ViewType.Grid) {
        return (
            <div
                className="bg-card rounded-lg border border-border cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/viewer/libraries/${library.id}`)}
            >
                <div className="flex items-center justify-between p-4 gap-2 border-b border-border">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <img
                            src={library.thumbnail_url ?? ''}
                            alt={`${library.title} thumbnail`}
                            className="w-12 h-12 flex-shrink-0 object-cover"
                        />
                        <h3 className="text-sm font-medium text-foreground line-clamp-2 min-h-[2.5rem]">
                            {library.title}
                        </h3>
                    </div>
                    <div className="flex self-start gap-1 flex-shrink-0">
                        {onSearchClick && (
                            <Button
                                id="knowledge-center-search-lib"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={handleSearchClick}
                            >
                                <Search className="size-4" />
                            </Button>
                        )}
                        <Button
                            id="knowledge-center-fav-lib"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) =>
                                void handleToggleAction('favorite', e)
                            }
                        >
                            <FavoriteIcon />
                        </Button>
                    </div>
                </div>
                <div className="p-4 space-y-2">
                    <p className="text-xs text-muted-foreground">Kiwix</p>
                    <p className="text-xs text-muted-foreground h-10 leading-5 line-clamp-2">
                        {library.description}
                    </p>
                    {isAdmin && (
                        <div
                            className="flex items-center gap-2 pt-1"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Switch
                                checked={visible}
                                onCheckedChange={() =>
                                    void handleToggleAction('toggle')
                                }
                                className="data-[state=checked]:bg-[#556830]"
                            />
                            <span className="text-xs text-muted-foreground">
                                {visible ? 'Visible' : 'Hidden'}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className="bg-card rounded-lg border border-border p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/viewer/libraries/${library.id}`)}
        >
            <img
                src={library.thumbnail_url ?? ''}
                alt={`${library.title} thumbnail`}
                className="w-16 h-16 flex-shrink-0 object-cover"
            />
            <div className="flex flex-col flex-1 min-w-0">
                <h3 className="text-sm font-medium text-foreground">
                    {library.title}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                    {library.description}
                </p>
            </div>
            <div className="flex items-center gap-2">
                {onSearchClick && (
                    <Button
                        id="knowledge-center-search-lib"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={handleSearchClick}
                    >
                        <Search className="size-4" />
                    </Button>
                )}
                <Button
                    id="knowledge-center-fav-lib"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => void handleToggleAction('favorite', e)}
                >
                    <FavoriteIcon />
                </Button>
                {isAdmin && (
                    <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Switch
                            checked={visible}
                            onCheckedChange={() =>
                                void handleToggleAction('toggle')
                            }
                            className="data-[state=checked]:bg-[#556830]"
                        />
                        <span className="text-xs text-muted-foreground">
                            {visible ? 'Visible' : 'Hidden'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
