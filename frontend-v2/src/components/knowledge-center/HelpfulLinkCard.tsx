import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Star, StarOff, Pencil, Trash2 } from 'lucide-react';
import {
    HelpfulLink,
    ModalType,
    ToastState,
    UserRole,
    ViewType,
    ServerResponseOne
} from '@/types';
import { useAuth, isAdministrator, AdminRoles } from '@/auth/useAuth';
import { useToast } from '@/contexts/ToastContext';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import API from '@/api/api';

interface HelpfulLinkCardProps {
    link: HelpfulLink;
    showModal?: (
        link: HelpfulLink,
        type: ModalType,
        e: React.MouseEvent
    ) => void;
    mutate?: () => void;
    role: UserRole;
    view?: ViewType;
}

export default function HelpfulLinkCard({
    link,
    showModal,
    mutate,
    role,
    view = ViewType.Grid
}: HelpfulLinkCardProps) {
    const [visible, setVisible] = useState(link.visibility_status);
    const [favorite, setFavorite] = useState(link.is_favorited);
    const { toaster } = useToast();
    const { user } = useAuth();
    const route = useLocation();
    const isAdmin = AdminRoles.includes(role);

    const adminWithStudentView = (): boolean => {
        return !route.pathname.includes('management') && isAdministrator(user);
    };

    const handleToggleAction = async (
        action: 'favorite' | 'toggle',
        e?: React.MouseEvent
    ) => {
        if (e) e.stopPropagation();
        if (adminWithStudentView()) {
            toaster(
                "You're in preview mode. Changes cannot be made.",
                ToastState.null
            );
            return;
        }
        const response = await API.put<null, object>(
            `helpful-links/${action}/${link.id}`,
            {}
        );
        const actionString =
            action === 'favorite'
                ? favorite
                    ? 'unfavorited'
                    : 'favorited'
                : visible
                  ? 'is now hidden'
                  : 'is now visible';
        if (response.success) {
            toaster(`Helpful link ${actionString}`, ToastState.success);
            mutate?.();
            if (action === 'favorite') setFavorite(!favorite);
            else setVisible(!visible);
        } else {
            toaster(`Helpful link ${actionString}`, ToastState.error);
        }
    };

    async function handleHelpfulLinkClick(id: number): Promise<void> {
        const resp = (await API.put<{ url: string }, object>(
            `helpful-links/activity/${id}`,
            {}
        )) as ServerResponseOne<{ url: string }>;
        if (resp.success) {
            window.open(resp.data.url, '_blank');
        }
    }

    if (view === ViewType.Grid) {
        return (
            <div
                className="bg-white rounded-lg border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => void handleHelpfulLinkClick(link.id)}
            >
                <div className="flex items-center justify-between p-4 gap-2 border-b border-gray-200">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <img
                            src={link.thumbnail_url ?? ''}
                            alt={link.title}
                            className="w-12 h-12 flex-shrink-0 object-cover"
                        />
                        <h3 className="text-sm font-medium text-[#203622] line-clamp-2">
                            {link.title}
                        </h3>
                    </div>
                    <div className="flex self-start gap-1 flex-shrink-0">
                        {isAdmin ? (
                            showModal && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={(e) =>
                                            showModal(link, ModalType.Edit, e)
                                        }
                                    >
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={(e) =>
                                            showModal(link, ModalType.Delete, e)
                                        }
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </>
                            )
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) =>
                                    void handleToggleAction('favorite', e)
                                }
                            >
                                {favorite ? (
                                    <Star className="size-5 fill-[#F1B51C] text-[#F1B51C]" />
                                ) : (
                                    <StarOff className="size-5" />
                                )}
                            </Button>
                        )}
                    </div>
                </div>
                <div className="p-4 space-y-2">
                    <p className="text-xs text-muted-foreground h-10 leading-5 line-clamp-2">
                        {link.description}
                    </p>
                    {isAdmin && (
                        <div className="flex items-center gap-2 pt-1">
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
            className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => void handleHelpfulLinkClick(link.id)}
        >
            <img
                src={link.thumbnail_url ?? ''}
                alt={link.title}
                className="w-16 h-16 flex-shrink-0 object-cover"
            />
            <div className="flex flex-col flex-1 min-w-0">
                <h3 className="text-sm font-medium text-[#203622]">
                    {link.title}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                    {link.description}
                </p>
            </div>
            <div className="flex items-center gap-2">
                {isAdmin ? (
                    showModal && (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) =>
                                    showModal(link, ModalType.Edit, e)
                                }
                            >
                                <Pencil className="size-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) =>
                                    showModal(link, ModalType.Delete, e)
                                }
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </>
                    )
                ) : (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) =>
                            void handleToggleAction('favorite', e)
                        }
                    >
                        {favorite ? (
                            <Star className="size-5 fill-[#F1B51C] text-[#F1B51C]" />
                        ) : (
                            <StarOff className="size-5" />
                        )}
                    </Button>
                )}
                {isAdmin && (
                    <div className="flex items-center gap-2">
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
