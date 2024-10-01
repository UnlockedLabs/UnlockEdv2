import { useNavigate } from 'react-router-dom';
import { ProviderPlatform, ProviderPlatformState } from '@/common';
import {
    CheckCircleIcon,
    InformationCircleIcon,
    LinkIcon,
    PencilSquareIcon,
    UserGroupIcon
} from '@heroicons/react/24/outline';
import TealPill from './pill-labels/TealPill';
import YellowPill from './pill-labels/YellowPill';
import OutcomePill from './pill-labels/GreyPill';
import { XMarkIcon } from '@heroicons/react/24/solid';

export default function ProviderCard({
    provider,
    openEditProvider,
    oidcClient,
    showAuthorizationInfo,
    archiveProvider
}: {
    provider: ProviderPlatform;
    openEditProvider: (prov: ProviderPlatform) => void;
    oidcClient: (prov: ProviderPlatform) => void;
    showAuthorizationInfo: (prov: ProviderPlatform) => void;
    archiveProvider: (prov: ProviderPlatform) => void;
}) {
    const navigate = useNavigate();
    return (
        <tr className="bg-base-teal card p-4 w-full grid-cols-4 justify-items-center">
            <td className="justify-self-start">{provider.name}</td>
            <td>
                {provider.oidc_id !== 0 ? (
                    <CheckCircleIcon className="w-4" />
                ) : (
                    <div className="w-4"></div>
                )}
            </td>
            <td>
                {/* TO DO: FINISH THIS */}
                {provider.state == ProviderPlatformState.ENABLED ? (
                    <TealPill>enabled</TealPill>
                ) : provider.state == ProviderPlatformState.DISABLED ? (
                    <OutcomePill outcome={undefined}>disabled</OutcomePill>
                ) : provider.state == ProviderPlatformState.ARCHIVED ? (
                    <YellowPill>archived</YellowPill>
                ) : (
                    <p>Status unavailable</p>
                )}
            </td>
            <td className="flex flex-row gap-3 justify-self-end">
                {provider.state !== ProviderPlatformState.ARCHIVED ? (
                    <>
                        {provider.oidc_id !== 0 ? (
                            <>
                                <div className="tooltip" data-tip="Auth Info">
                                    <InformationCircleIcon
                                        className="w-4"
                                        onClick={() =>
                                            showAuthorizationInfo(provider)
                                        }
                                    />
                                </div>
                                {provider.type !== 'kolibri' && (
                                    <div
                                        className="tooltip"
                                        data-tip="Manage Users"
                                    >
                                        <UserGroupIcon
                                            className="w-4"
                                            onClick={() =>
                                                navigate(
                                                    `/provider-users/${provider.id}`
                                                )
                                            }
                                        />
                                    </div>
                                )}
                            </>
                        ) : (
                            <div
                                className="tooltip"
                                data-tip="Register Provider"
                            >
                                <LinkIcon
                                    className="w-4 "
                                    onClick={() => oidcClient(provider)}
                                />
                            </div>
                        )}
                        <div className="tooltip" data-tip="Edit Provider">
                            <PencilSquareIcon
                                className="w-4"
                                onClick={() => openEditProvider(provider)}
                            />
                        </div>
                        <div
                            className="tooltip"
                            data-tip="Disable/Archive Provider"
                        >
                            <XMarkIcon
                                className="w-4"
                                onClick={() => archiveProvider(provider)}
                            />
                        </div>
                    </>
                ) : (
                    <div className="tooltip" data-tip="Enable Provider">
                        <CheckCircleIcon
                            className="w-4"
                            onClick={() => archiveProvider(provider)}
                        />
                    </div>
                )}
            </td>
        </tr>
    );
}
