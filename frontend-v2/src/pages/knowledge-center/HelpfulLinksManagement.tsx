import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import {
    HelpfulLink,
    HelpfulLinkAndSort,
    ModalType,
    ServerResponseOne,
    ToastState,
    UserRole,
    ViewType
} from '@/types';
import { useAuth } from '@/auth/useAuth';
import { useToast } from '@/contexts/ToastContext';
import { useUrlPagination } from '@/hooks/useUrlPagination';
import { useCheckResponse } from '@/hooks/useCheckResponse';
import { HelpfulLinkCard } from '@/components/knowledge-center';
import { EmptyState } from '@/components/shared/EmptyState';
import { FormModal } from '@/components/shared/FormModal';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Link as LinkIcon } from 'lucide-react';
import API from '@/api/api';

interface LinkFormData {
    title: string;
    url: string;
    description: string;
}

interface OutletContextType {
    activeView: ViewType;
    searchQuery: string;
    sortQuery: string;
}

export default function HelpfulLinksManagement() {
    const { user } = useAuth();
    const { toaster } = useToast();
    const { page, perPage, setPage } = useUrlPagination(1, 20);

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [currentLink, setCurrentLink] = useState<HelpfulLink | null>(null);

    const addForm = useForm<LinkFormData>();
    const editForm = useForm<LinkFormData>();

    const { activeView, searchQuery, sortQuery } =
        useOutletContext<OutletContextType>();

    const { data, mutate, error, isLoading } = useSWR<
        ServerResponseOne<HelpfulLinkAndSort>
    >(
        `/api/helpful-links?search=${searchQuery}&page=${page}&per_page=${perPage}${sortQuery}`
    );

    const checkDelete = useCheckResponse<HelpfulLinkAndSort>({
        mutate,
        closeDialog: () => setDeleteDialogOpen(false)
    });

    const helpfulLinks = data?.data?.helpful_links ?? [];
    const meta = data?.data?.meta;
    const totalPages = meta?.last_page ?? 1;

    async function handleAddLink(formData: LinkFormData) {
        const response = await API.post<null, object>(
            'helpful-links',
            formData
        );
        if (response.success) {
            toaster('Helpful link added successfully', ToastState.success);
            setAddModalOpen(false);
            addForm.reset();
            void mutate();
        } else {
            toaster(
                response.message || 'Failed to add link',
                ToastState.error
            );
        }
    }

    async function handleEditLink(formData: LinkFormData) {
        if (!currentLink) return;
        const response = await API.patch<null, object>(
            `helpful-links/${currentLink.id}`,
            formData
        );
        if (response.success) {
            toaster('Helpful link updated successfully', ToastState.success);
            setEditModalOpen(false);
            editForm.reset();
            setCurrentLink(null);
            void mutate();
        } else {
            toaster(
                response.message || 'Failed to update link',
                ToastState.error
            );
        }
    }

    async function handleDeleteLink() {
        if (!currentLink) return;
        const response = await API.delete(`helpful-links/${currentLink.id}`);
        checkDelete(
            response.success,
            'Error deleting link',
            'Link successfully deleted'
        );
        setCurrentLink(null);
    }

    function showModifyLink(
        link: HelpfulLink,
        type: ModalType,
        e: React.MouseEvent
    ) {
        e.stopPropagation();
        setCurrentLink(link);
        if (type === ModalType.Edit) {
            editForm.reset({
                title: link.title,
                url: link.url,
                description: link.description
            });
            setEditModalOpen(true);
        } else if (type === ModalType.Delete) {
            setDeleteDialogOpen(true);
        }
    }

    if (isLoading) {
        return (
            <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-44 w-full rounded-lg" />
                ))}
            </div>
        );
    }

    return (
        <>
            <div className="flex justify-end">
                <Button
                    className="bg-[#F1B51C] text-foreground hover:bg-[#F1B51C]/90"
                    onClick={() => {
                        addForm.reset();
                        setAddModalOpen(true);
                    }}
                >
                    <Plus className="size-4" />
                    Add Link
                </Button>
            </div>

            {helpfulLinks.length === 0 ? (
                <EmptyState
                    icon={
                        <LinkIcon className="size-6 text-muted-foreground" />
                    }
                    title="No helpful links found"
                    description="Add helpful links for residents to access"
                />
            ) : (
                <div
                    className={
                        activeView === ViewType.Grid
                            ? 'grid grid-cols-4 gap-4'
                            : 'space-y-3'
                    }
                >
                    {helpfulLinks.map((link: HelpfulLink) => (
                        <HelpfulLinkCard
                            key={link.id}
                            link={link}
                            mutate={() => void mutate()}
                            showModal={showModifyLink}
                            role={user?.role ?? UserRole.Student}
                            view={activeView}
                        />
                    ))}
                </div>
            )}

            {!error && totalPages > 1 && (
                <div className="flex justify-center pt-4">
                    <Pagination>
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    onClick={() =>
                                        page > 1 && setPage(page - 1)
                                    }
                                    className={
                                        page <= 1
                                            ? 'pointer-events-none opacity-50'
                                            : 'cursor-pointer'
                                    }
                                />
                            </PaginationItem>
                            {Array.from(
                                { length: Math.min(totalPages, 5) },
                                (_, i) => {
                                    let pageNum: number;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (page <= 3) pageNum = i + 1;
                                    else if (page >= totalPages - 2)
                                        pageNum = totalPages - 4 + i;
                                    else pageNum = page - 2 + i;
                                    return (
                                        <PaginationItem key={pageNum}>
                                            <PaginationLink
                                                onClick={() =>
                                                    setPage(pageNum)
                                                }
                                                isActive={pageNum === page}
                                                className="cursor-pointer"
                                            >
                                                {pageNum}
                                            </PaginationLink>
                                        </PaginationItem>
                                    );
                                }
                            )}
                            <PaginationItem>
                                <PaginationNext
                                    onClick={() =>
                                        page < totalPages &&
                                        setPage(page + 1)
                                    }
                                    className={
                                        page >= totalPages
                                            ? 'pointer-events-none opacity-50'
                                            : 'cursor-pointer'
                                    }
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </div>
            )}

            <FormModal
                open={addModalOpen}
                onOpenChange={setAddModalOpen}
                title="Add Helpful Link"
            >
                <form
                    onSubmit={addForm.handleSubmit((d) =>
                        void handleAddLink(d)
                    )}
                    className="space-y-4"
                >
                    <div className="space-y-2">
                        <Label htmlFor="add-title">Title</Label>
                        <Input
                            id="add-title"
                            {...addForm.register('title', { required: true })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="add-url">URL</Label>
                        <Input
                            id="add-url"
                            placeholder="https://..."
                            {...addForm.register('url', { required: true })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="add-desc">Description</Label>
                        <Textarea
                            id="add-desc"
                            {...addForm.register('description')}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => setAddModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-[#203622] text-white hover:bg-[#203622]/90"
                        >
                            Save
                        </Button>
                    </div>
                </form>
            </FormModal>

            <FormModal
                open={editModalOpen}
                onOpenChange={setEditModalOpen}
                title="Edit Helpful Link"
            >
                <form
                    onSubmit={editForm.handleSubmit((d) =>
                        void handleEditLink(d)
                    )}
                    className="space-y-4"
                >
                    <div className="space-y-2">
                        <Label htmlFor="edit-title">Title</Label>
                        <Input
                            id="edit-title"
                            {...editForm.register('title', {
                                required: true
                            })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-url">URL</Label>
                        <Input
                            id="edit-url"
                            {...editForm.register('url', { required: true })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-desc">Description</Label>
                        <Textarea
                            id="edit-desc"
                            {...editForm.register('description')}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => setEditModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-[#203622] text-white hover:bg-[#203622]/90"
                        >
                            Save
                        </Button>
                    </div>
                </form>
            </FormModal>

            <ConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title="Delete Link"
                description="Are you sure you would like to delete this helpful link? This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => void handleDeleteLink()}
                variant="destructive"
            />
        </>
    );
}
