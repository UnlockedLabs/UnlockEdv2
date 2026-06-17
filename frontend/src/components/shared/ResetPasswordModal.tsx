import { useCallback, useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import API from '@/api/api';
import { ResetPasswordResponse, ServerResponseOne } from '@/types';
import { DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormModal } from './FormModal';

type Phase = 'confirm' | 'result';

type Subject = 'resident' | 'administrator';

interface ResetPasswordModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Display name of the account whose password is being reset. */
    name: string;
    /**
     * Whose password this is — controls the copy ("resident" vs
     * "administrator"). Defaults to 'resident'.
     */
    subject?: Subject;
    /**
     * Confirm mode: the id of the user to reset. The modal performs the reset
     * itself (confirm phase → result phase). Provide this for the normal reset
     * flow. Ignored when `presetPassword` is given.
     */
    userId?: number;
    /**
     * Result-only mode: a password that has already been generated (e.g. shown
     * right after account creation). When provided the confirm phase is skipped
     * and the password is displayed immediately.
     */
    presetPassword?: string;
    /** Title for the result phase. Defaults to 'Password Reset'. */
    resultTitle?: string;
    /** Optional callback fired after a reset successfully completes. */
    onResetComplete?: () => void;
}

export function ResetPasswordModal({
    open,
    onOpenChange,
    name,
    subject = 'resident',
    userId,
    presetPassword,
    resultTitle = 'Password Reset',
    onResetComplete
}: ResetPasswordModalProps) {
    const resultOnly = presetPassword !== undefined;
    const [phase, setPhase] = useState<Phase>(
        resultOnly ? 'result' : 'confirm'
    );
    const [tempPassword, setTempPassword] = useState(presetPassword ?? '');
    const [copied, setCopied] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Keep internal state in sync with whichever mode the modal is opened in.
    useEffect(() => {
        if (open) {
            setPhase(resultOnly ? 'result' : 'confirm');
            setTempPassword(presetPassword ?? '');
            setCopied(false);
            setSubmitting(false);
        }
    }, [open, resultOnly, presetPassword]);

    const handleClose = useCallback(
        (isOpen: boolean) => {
            if (!isOpen) {
                setPhase(resultOnly ? 'result' : 'confirm');
                setTempPassword(presetPassword ?? '');
                setCopied(false);
            }
            onOpenChange(isOpen);
        },
        [onOpenChange, resultOnly, presetPassword]
    );

    const handleReset = async () => {
        if (userId === undefined) return;
        setSubmitting(true);
        const resp = await API.post<
            ResetPasswordResponse,
            Record<string, never>
        >(`users/${userId}/student-password`, {});
        setSubmitting(false);
        if (resp.success) {
            const data = (resp as ServerResponseOne<ResetPasswordResponse>)
                .data;
            setTempPassword(data.temp_password);
            toast.success(`Password reset for ${name}`);
            setPhase('result');
            onResetComplete?.();
        } else {
            toast.error(resp.message ?? 'Failed to reset password');
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(tempPassword);
        } catch {
            // Fallback for browsers without the async Clipboard API.
            const textArea = document.createElement('textarea');
            textArea.value = tempPassword;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isConfirmPhase = phase === 'confirm';

    return (
        <FormModal
            open={open}
            onOpenChange={handleClose}
            title={isConfirmPhase ? 'Reset Password' : resultTitle}
            description={
                isConfirmPhase
                    ? `Are you sure you want to reset ${name}'s password?`
                    : `New temporary password for ${name}`
            }
            titleClassName="text-foreground"
        >
            {isConfirmPhase ? (
                <>
                    <div className="py-4">
                        <p className="text-sm text-gray-600">
                            This will generate a temporary password for the{' '}
                            {subject}. They will be required to change it on
                            their next login.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => handleClose(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => void handleReset()}
                            disabled={submitting}
                            variant="brand"
                        >
                            Reset Password
                        </Button>
                    </DialogFooter>
                </>
            ) : (
                <>
                    <div className="py-4">
                        <div className="bg-gray-100 rounded-lg p-4 border border-gray-300">
                            <div className="text-sm text-gray-600 mb-2">
                                Temporary Password
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-lg font-mono font-semibold text-brand-dark select-all">
                                    {tempPassword}
                                </code>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void handleCopy()}
                                >
                                    {copied ? (
                                        <>
                                            <Check className="size-4 mr-2" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="size-4 mr-2" />
                                            Copy
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-4">
                            Share this password securely with the {subject}.
                            They will be prompted to change it on their next
                            login.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={() => handleClose(false)}
                            variant="brand"
                        >
                            Done
                        </Button>
                    </DialogFooter>
                </>
            )}
        </FormModal>
    );
}
