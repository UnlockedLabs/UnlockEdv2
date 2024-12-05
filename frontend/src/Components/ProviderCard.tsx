import { useNavigate } from 'react-router-dom';
import {
    ProviderPlatform,
    ProviderPlatformState,
    ProviderPlatformType
} from '@/common';
import {
    ArrowPathIcon,
    CheckCircleIcon,
    InformationCircleIcon,
    LinkIcon,
    PencilSquareIcon,
    UserGroupIcon
} from '@heroicons/react/24/outline';
import TealPill from './pill-labels/TealPill';
import YellowPill from './pill-labels/YellowPill';
import GreyPill from './pill-labels/GreyPill';
import { XMarkIcon } from '@heroicons/react/24/solid';
import ULIComponent from '@/Components/ULIComponent.tsx';

export default function ProviderCard({
    provider,
    openEditProvider,
    oidcClient,
    showAuthorizationInfo,
    refreshToken,
    archiveProvider
}: {
    provider: ProviderPlatform;
    openEditProvider: (prov: ProviderPlatform) => void;
    oidcClient: (prov: ProviderPlatform) => void;
    showAuthorizationInfo: (prov: ProviderPlatform) => void;
    refreshToken: (prov: ProviderPlatform) => void; 
    archiveProvider: (prov: ProviderPlatform) => void;
}) {
    const navigate = useNavigate();
    return (
        <tr className="bg-base-teal card p-4 w-full grid-cols-4 justify-items-center">
            <td className="justify-self-start">{provider.name}</td>
            <td>
                {provider.oidc_id !== 0 || provider.type === ProviderPlatformType.BRIGHTSPACE ? (
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
                    <GreyPill>disabled</GreyPill>
                ) : provider.state == ProviderPlatformState.ARCHIVED ? (
                    <YellowPill>archived</YellowPill>
                ) : (
                    <p>Status unavailable</p>
                )}
            </td>
            <td className="flex flex-row gap-3 justify-self-end">
                {provider.state !== ProviderPlatformState.ARCHIVED ? (
                    <>
                        {provider.oidc_id !== 0 || provider.type === ProviderPlatformType.BRIGHTSPACE ? (
                            <>
                                {provider.type === ProviderPlatformType.BRIGHTSPACE ? (
                                    <ULIComponent
                                    dataTip={'Refresh Token'}
                                    icon={ArrowPathIcon}
                                    onClick={() =>
                                        refreshToken(provider)
                                    }
                                />
                                ) : ( <ULIComponent
                                    dataTip={'Auth Info'}
                                    icon={InformationCircleIcon}
                                    onClick={() =>
                                        showAuthorizationInfo(provider)
                                    }
                                />)
                                }
                                {provider.type !==
                                    ProviderPlatformType.KOLIBRI && (
                                    <ULIComponent
                                        dataTip={'Manage Users'}
                                        icon={UserGroupIcon}
                                        onClick={() =>
                                            navigate(
                                                `/provider-users/${provider.id}`
                                            )
                                        }
                                    />
                                )}
                            </>
                        ) : (
                            <ULIComponent
                                dataTip={'Register Provider'}
                                icon={LinkIcon}
                                onClick={() => oidcClient(provider)}
                            />
                        )}
                        <ULIComponent
                            dataTip={'Edit Provider'}
                            icon={PencilSquareIcon}
                            onClick={() => openEditProvider(provider)}
                        />
                        <ULIComponent
                            dataTip={'Disable'}
                            icon={XMarkIcon}
                            onClick={() => archiveProvider(provider)}
                        />
                    </>
                ) : (
                    <ULIComponent
                        dataTip={'Enable Provider'}
                        icon={CheckCircleIcon}
                        onClick={() => archiveProvider(provider)}
                    />
                )}
            </td>
        </tr>
    );
}
