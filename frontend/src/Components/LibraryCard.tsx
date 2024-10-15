import { useState } from 'react';
import VisibleHiddenToggle from './VisibleHiddenToggle';
import {
    Library,
    ServerResponseMany,
    ToastProps,
    ToastState,
    UserRole
} from '@/common';
import API from '@/api/api';
import { KeyedMutator } from 'swr';
import { useNavigate } from 'react-router-dom';

export default function LibraryCard({
    library,
    setToast,
    mutate,
    role
}: {
    library: Library;
    setToast: React.Dispatch<React.SetStateAction<ToastProps>>;
    mutate: KeyedMutator<ServerResponseMany<Library>>;
    role: UserRole;
}) {
    const [visible, setVisible] = useState<boolean>(library.visibility_status);
    const navigate = useNavigate();

    function changeVisibility(visibilityStatus: boolean) {
        if (visibilityStatus == !visible) {
            setVisible(visibilityStatus);
            void handleToggleVisibility();
        }
    }

    const handleToggleVisibility = async () => {
        const response = await API.put(`libraries/${library.id}`, {});
        if (response.success) {
            setToast({
                state: ToastState.success,
                message: response.message
            });
            await mutate();
        } else {
            setToast({
                state: ToastState.error,
                message: response.message
            });
        }
    };
    const openContentProviderName =
        library?.open_content_provider.name.charAt(0).toUpperCase() +
        library?.open_content_provider.name.slice(1);

    return (
        <div
            className="card overflow-hidden cursor-pointer"
            onClick={() => navigate(`/viewer/libraries/${library.id}`)}
        >
            <div className="flex p-4 gap-2 border-b-2">
                <figure className="w-[48px] h-[48px] bg-cover">
                    <img
                        src={
                            library?.open_content_provider.url +
                            library?.image_url
                        }
                        alt={`${library.name} thumbnail`}
                    />
                </figure>
                <h3 className="w-3/4 body my-auto">{library.name}</h3>
            </div>
            <div className="p-4 space-y-2">
                <p className="body-small">{openContentProviderName}</p>
                <p className="body-small h-[40px] leading-5 line-clamp-2">
                    {library?.description}
                </p>
                {role === UserRole.Admin && (
                    <VisibleHiddenToggle
                        visible={visible}
                        changeVisibility={changeVisibility}
                    />
                )}
            </div>
        </div>
    );
}
