import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import API from '@/api/api';
import { DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FormModal } from '@/components/shared';

interface AddNoteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    residentId: string;
    residentName: string;
    onSuccess: () => void;
}

export function AddNoteDialog({
    open,
    onOpenChange,
    residentId,
    residentName,
    onSuccess
}: AddNoteDialogProps) {
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!open) setNote('');
    }, [open]);

    const handleSubmit = async () => {
        if (!note.trim()) return;
        setSubmitting(true);
        const resp = await API.post(`users/${residentId}/notes`, {
            note: note.trim()
        });
        setSubmitting(false);
        if (resp.success) {
            toast.success('Historical note added');
            setNote('');
            onSuccess();
            onOpenChange(false);
        } else {
            toast.error(resp.message);
        }
    };

    return (
        <FormModal
            open={open}
            onOpenChange={onOpenChange}
            title="Add Historical Note"
            description={`Add context or supportive information to ${residentName}'s profile`}
            titleClassName="text-foreground"
        >
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="note">Note</Label>
                    <Textarea
                        id="note"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Add contextual information, support plans, or important updates..."
                        rows={4}
                        className="[overflow-wrap:anywhere] [field-sizing:normal]"
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                </Button>
                <Button
                    onClick={() => void handleSubmit()}
                    disabled={submitting || !note.trim()}
                    variant="brand"
                >
                    Add Note
                </Button>
            </DialogFooter>
        </FormModal>
    );
}
