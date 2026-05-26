import { useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import { useAuth, fetchUser } from '@/auth/useAuth';
import { FeatureAccess } from '@/types';
import API from '@/api/api';
import { PageHeader } from '@/components/shared/PageHeader';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type ToggleTarget =
    | { type: 'feature'; key: FeatureAccess }
    | { type: 'page-feature'; key: FeatureAccess };

interface PendingToggle {
    target: ToggleTarget;
    name: string;
    newValue: boolean;
}

export default function FeatureControl() {
    const { user, setUser } = useAuth();
    const [pending, setPending] = useState<PendingToggle | null>(null);
    const [loading, setLoading] = useState(false);

    if (!user) return null;

    const isEnabled = (feature: FeatureAccess) =>
        user.feature_access.includes(feature);

    const kcEnabled = isEnabled(FeatureAccess.OpenContentAccess);

    const requestToggle = (
        target: ToggleTarget,
        name: string,
        currentValue: boolean
    ) => {
        setPending({ target, name, newValue: !currentValue });
    };

    const handleConfirm = async () => {
        if (!pending) return;
        setLoading(true);
        try {
            const { target, name, newValue } = pending;
            const urlSegment =
                target.type === 'feature' ? 'features' : 'page-features';
            const resp = await API.put<string, void>(
                `auth/${urlSegment}/${target.key}`,
                undefined
            );
            if (!resp.success) {
                toast.error(`Failed to ${newValue ? 'enable' : 'disable'} ${name}`);
                return;
            }
            const updated = await fetchUser();
            if (updated) setUser(updated);
            toast.success(`${name} ${newValue ? 'enabled' : 'disabled'} successfully`);
            setPending(null);
        } catch {
            toast.error('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const isDisabling = pending ? !pending.newValue : false;
    const affectsResidents =
        pending?.target.key !== FeatureAccess.ProviderAccess;

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Feature Control"
                subtitle="Manage which features are available across the system"
            />

            <div className="space-y-4">
                {/* Knowledge Center */}
                <div className="bg-background border border-border rounded-lg p-6">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-brand-dark dark:text-white">
                                Knowledge Center
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Provides educational content, videos, and resources for residents
                            </p>
                        </div>
                        <Switch
                            checked={kcEnabled}
                            onCheckedChange={() =>
                                requestToggle(
                                    { type: 'feature', key: FeatureAccess.OpenContentAccess },
                                    'Knowledge Center',
                                    kcEnabled
                                )
                            }
                        />
                    </div>

                    <div className="mt-4 bg-muted rounded-md p-4">
                        <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                            <AlertCircle className="size-4 shrink-0" />
                            <span>Sub-features (only available when Knowledge Center is enabled)</span>
                        </div>

                        <div className="space-y-4">
                            <SubFeatureRow
                                label="Request Content Button"
                                description="Allows residents to submit requests for new content to be added to the Knowledge Center"
                                enabled={isEnabled(FeatureAccess.RequestContentAccess)}
                                parentEnabled={kcEnabled}
                                onToggle={() =>
                                    requestToggle(
                                        { type: 'page-feature', key: FeatureAccess.RequestContentAccess },
                                        'Request Content Button',
                                        isEnabled(FeatureAccess.RequestContentAccess)
                                    )
                                }
                            />
                            <SubFeatureRow
                                label="Helpful Links"
                                description="Enables the Helpful Links tab for residents and allows admins to add/manage helpful resources"
                                enabled={isEnabled(FeatureAccess.HelpfulLinksAccess)}
                                parentEnabled={kcEnabled}
                                onToggle={() =>
                                    requestToggle(
                                        { type: 'page-feature', key: FeatureAccess.HelpfulLinksAccess },
                                        'Helpful Links',
                                        isEnabled(FeatureAccess.HelpfulLinksAccess)
                                    )
                                }
                            />
                            <SubFeatureRow
                                label="Videos"
                                description="Enables video content viewing for residents and allows admins to upload/manage videos"
                                enabled={isEnabled(FeatureAccess.UploadVideoAccess)}
                                parentEnabled={kcEnabled}
                                onToggle={() =>
                                    requestToggle(
                                        { type: 'page-feature', key: FeatureAccess.UploadVideoAccess },
                                        'Videos',
                                        isEnabled(FeatureAccess.UploadVideoAccess)
                                    )
                                }
                            />
                        </div>
                    </div>
                </div>

                {/* Program Hub & Tracking */}
                <div className="bg-background border border-border rounded-lg p-6">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-brand-dark dark:text-white">
                                Program Hub & Tracking
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Enables program management, class scheduling, attendance tracking, and resident enrollment functionality
                            </p>
                        </div>
                        <Switch
                            checked={isEnabled(FeatureAccess.ProgramAccess)}
                            onCheckedChange={() =>
                                requestToggle(
                                    { type: 'feature', key: FeatureAccess.ProgramAccess },
                                    'Program Hub & Tracking',
                                    isEnabled(FeatureAccess.ProgramAccess)
                                )
                            }
                        />
                    </div>
                    <p className="text-sm text-muted-foreground italic">
                        No additional configuration options
                    </p>
                </div>
            </div>

            {/* Confirmation Dialog */}
            <Dialog open={!!pending} onOpenChange={() => !loading && setPending(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {pending?.newValue ? 'Enable' : 'Disable'} {pending?.name}?
                        </DialogTitle>
                        <DialogDescription>
                            {pending?.newValue ? (
                                <>
                                    This will add {pending.name} to all{' '}
                                    {affectsResidents ? 'resident and admin' : 'admin'} views
                                    immediately.
                                </>
                            ) : (
                                <>
                                    This will remove {pending?.name} from all{' '}
                                    {affectsResidents ? 'resident and admin' : 'admin'} views
                                    immediately.
                                    {affectsResidents && (
                                        <> Residents will no longer be able to access this feature.</>
                                    )}
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {isDisabling && affectsResidents && (
                        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3 flex gap-2">
                            <AlertCircle className="size-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                                This affects all facilities and residents statewide.
                            </p>
                        </div>
                    )}

                    <div className="flex gap-3 justify-end pt-2">
                        <Button
                            variant="outline"
                            onClick={() => setPending(null)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void handleConfirm()}
                            disabled={loading}
                            className={
                                pending?.newValue
                                    ? 'bg-brand hover:bg-brand-dark text-white'
                                    : 'bg-amber-600 hover:bg-amber-700 text-white'
                            }
                        >
                            {pending?.newValue ? 'Enable' : 'Disable'} Feature
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

interface SubFeatureRowProps {
    label: string;
    description: string;
    enabled: boolean;
    parentEnabled: boolean;
    onToggle: () => void;
}

function SubFeatureRow({
    label,
    description,
    enabled,
    parentEnabled,
    onToggle
}: SubFeatureRowProps) {
    return (
        <div
            className={`flex items-start justify-between ${!parentEnabled ? 'opacity-50' : ''}`}
        >
            <div className="flex-1 pr-4">
                <h4 className="text-sm font-medium text-brand-dark dark:text-white">
                    {label}
                </h4>
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </div>
            <Switch
                checked={enabled}
                onCheckedChange={onToggle}
                disabled={!parentEnabled}
            />
        </div>
    );
}
