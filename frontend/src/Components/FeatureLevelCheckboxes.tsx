import CheckboxGeneric from './inputs/CheckboxGeneric';
import { FeatureAccess, ToastState, User } from '@/common';
import API from '@/api/api';
import { useToast } from '@/Context/ToastCtx';
import { Dispatch, SetStateAction, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUser } from '@/useAuth';
interface FeatureCheckboxesProps {
    features: FeatureAccess[];
    setUser: Dispatch<SetStateAction<User | undefined>>;
}

const KNOWLEDGE_BASE_PAGE_FEATURES = [
    { kind: 'request_content', label: 'Request Content' },
    { kind: 'helpful_links', label: 'Helpful Links' },
    { kind: 'upload_video', label: 'Upload Video' }
];
export default function FeatureLevelCheckboxes({
    features,
    setUser
}: FeatureCheckboxesProps) {
    const { toaster } = useToast();
    const navigate = useNavigate();
    interface CheckboxStates {
        kind: string;
        label: string;
        checked: boolean;
        pageFeatures?: CheckboxStates[];
    }
    const [checkboxStates, setCheckboxStates] = useState<CheckboxStates[]>([
        {
            kind: 'open_content',
            label: 'Knowledge Base',
            checked: features.includes(FeatureAccess.OpenContentAccess),
            pageFeatures: KNOWLEDGE_BASE_PAGE_FEATURES.map((pageFeature) => ({
                ...pageFeature,
                checked: features.includes(pageFeature.kind as FeatureAccess)
            }))
        },
        {
            kind: 'provider_platforms',
            label: 'Connected Learning',
            checked: features.includes(FeatureAccess.ProviderAccess)
        },
        {
            kind: 'program_management',
            label: 'Program Hub',
            checked: features.includes(FeatureAccess.ProgramAccess)
        }
    ]);

    const getFeatureChecked = (kind: string): boolean => {
        const checkboxState = checkboxStates.find(
            (state) => state.kind === kind
        );
        return checkboxState ? checkboxState.checked : false;
    };

    const getPageFeatureChecked = (pageFeatureKind: string): boolean => {
        const openContent = checkboxStates.find(
            (f) => f.kind === 'open_content'
        );
        if (!openContent?.pageFeatures) return false;
        const pageFeature = openContent.pageFeatures.find(
            (s) => s.kind === pageFeatureKind
        );
        return pageFeature ? pageFeature.checked : false;
    };

    const handleFeatureToggle = async (
        checked: boolean,
        feature: string
    ): Promise<void> => {
        const resp = await API.put<null, object>(
            `auth/features/${feature}`,
            {}
        );
        if (!resp.success) {
            toaster('Error toggling feature', ToastState.error);
            return;
        }
        setCheckboxStates((prevStates) =>
            prevStates.map((state) =>
                state.kind === feature ? { ...state, checked } : state
            )
        );
        toaster('Feature toggled successfully', ToastState.success);
        const user = await fetchUser();
        setUser(user);
        navigate('/authcallback');
    };

    const handlePageFeatureToggle = async (
        checked: boolean,
        pageFeatureKind: string
    ) => {
        const resp = await API.put<null, object>(
            `/auth/page-features/${pageFeatureKind}`,
            {}
        );
        if (!resp.success) {
            toaster('Error toggling page feature', ToastState.error);
            return;
        }
        setCheckboxStates((prev) =>
            prev.map((feature) =>
                feature.pageFeatures
                    ? {
                          ...feature,
                          pageFeatures: feature?.pageFeatures.map((state) =>
                              state.kind === pageFeatureKind
                                  ? { ...state, checked }
                                  : state
                          )
                      }
                    : feature
            )
        );
        toaster('Page feature toggled successfully', ToastState.success);
        const user = await fetchUser();
        setUser(user);
        navigate('/authcallback');
    };

    return (
        <>
            {checkboxStates.map((feature) => (
                <>
                    <li>
                        <CheckboxGeneric
                            name={feature.kind}
                            label={feature.label}
                            checked={getFeatureChecked(feature.kind)}
                            onChange={handleFeatureToggle}
                        />
                    </li>
                    <ul className="before:!hidden after:!hidden">
                        {feature.pageFeatures?.map((pageFeature) => (
                            <li key={pageFeature.kind}>
                                <CheckboxGeneric
                                    name={pageFeature.kind}
                                    label={pageFeature.label}
                                    checked={getPageFeatureChecked(
                                        pageFeature.kind
                                    )}
                                    onChange={handlePageFeatureToggle}
                                    disabled={!feature.checked}
                                />
                            </li>
                        ))}
                    </ul>
                </>
            ))}
        </>
    );
}
