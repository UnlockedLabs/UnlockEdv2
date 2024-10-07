import { useState } from 'react';
import VisibleHiddenToggle from './VisibleHiddenToggle';
import {
    Library,
    ServerResponse,
    ToastProps,
    ToastState,
    UserRole
} from '@/common';
import API from '@/api/api';
import { KeyedMutator } from 'swr';

// TO DO: update URLS to refelct the actual URL rather than the half generated one

export default function LibraryCard({
    library,
    setToast,
    mutate,
    role
}: {
    library: Library;
    setToast: React.Dispatch<React.SetStateAction<ToastProps>>;
    mutate: KeyedMutator<ServerResponse<Library[]>>;
    role: string;
}) {
    const [visible, setVisible] = useState<boolean>(library.visibility_status);

    function changeVisibility(visibilityStatus: boolean) {
        if (visibilityStatus == !visible) {
            setVisible(visibilityStatus);
            handleToggleVisibility();
        }
    }

    const handleToggleVisibility = async () => {
        const response = await API.put(`libraries/${library.id}`, {});
        if (response.success) {
            setToast({
                state: ToastState.success,
                message: response.message
            });
            mutate();
        } else {
            setToast({
                state: ToastState.error,
                message: response.message
            });
        }
    };

    return (
        <div className="card">
            <figure className="h-[100px]">
                {library.image_url ? (
                    <img
                        className="object-cover w-full h-full"
                        // TO DO: make sure that scraper is grabbing the entire URL so we dont have to append this
                        src={'https://library.kiwix.org' + library.image_url}
                        alt={`${library.name} thumbnail`}
                    />
                ) : (
                    <div className="bg-teal-1 h-full w-full"></div>
                )}
            </figure>
            <div className="p-4 space-y-2">
                <p className="body-small">
                    {library?.open_content_provider.name}
                </p>
                <h3 className="card-title text-sm line-clamp-1">
                    {library.name}
                </h3>
                <p className="body-small h-[40px] leading-5 line-clamp-2">
                    {library?.description}
                </p>
                {role == UserRole.Admin && (
                    <VisibleHiddenToggle
                        visible={visible}
                        changeVisibility={changeVisibility}
                    />
                )}
            </div>
        </div>
    );
}
