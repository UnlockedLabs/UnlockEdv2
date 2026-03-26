import { useCallback, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import API from '@/api/api';
import { User, ResetPasswordResponse, ServerResponseOne } from '@/types';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Phase = 'confirm' | 'result';

interface ResetPasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User;
}

export function ResetPasswordDialog({
    open,
    onOpenChange,
    user
}: ResetPasswordDialogProps) {
    const [phase, setPhase] = useState<Phase>('confirm');
    const [tempPassword, setTempPassword] = useState('');
    const [copied, setCopied] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleClose = useCallback(
        (isOpen: boolean) => {
            if (!isOpen) {
                setPhase('confirm');
                setTempPassword('');
                setCopied(false);
            }
            onOpenChange(isOpen);
        },
        [onOpenChange]
    );

    const handleReset = async () => {
        setSubmitting(true);
        const resp = await API.post<ResetPasswordResponse, Record<string, never>>(
            `users/${user.id}/student-password`,
            {}
        );
        setSubmitting(false);
        if (resp.success) {
            const data = (resp as ServerResponseOne<ResetPasswordResponse>)
                .data;
            setTempPassword(data.temp_password);
            toast.success('Password has been reset successfully');
            setPhase('result');
        } else {
            toast.error(resp.message);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(tempPassword);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const textArea = document.createElement('textarea');
            textArea.value = tempPassword;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent>
                {phase === 'confirm' ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Reset Password</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to reset{' '}
                                {user.name_first} {user.name_last}'s password?
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <p className="text-sm text-gray-600">
                                This will generate a temporary password for the
                                resident. They will be required to change it on
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
                                className="bg-[#556830] hover:bg-[#203622]"
                            >
                                Reset Password
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Password Reset</DialogTitle>
                            <DialogDescription>
                                New temporary password for {user.name_first}{' '}
                                {user.name_last}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <div className="bg-gray-100 rounded-lg p-4 border border-gray-300">
                                <div className="text-sm text-gray-600 mb-2">
                                    Temporary Password
                                </div>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 text-lg font-mono font-semibold text-[#203622]">
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
                                Share this password securely with the resident.
                                They will be prompted to change it on their next
                                login.
                            </p>
                        </div>
                        <DialogFooter>
                            <Button
                                onClick={() => handleClose(false)}
                                className="bg-[#556830] hover:bg-[#203622]"
                            >
                                Done
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
