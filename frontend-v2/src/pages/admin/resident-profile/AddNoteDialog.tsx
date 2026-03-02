import { useState } from 'react';
import { toast } from 'sonner';
import API from '@/api/api';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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

    const handleSubmit = async () => {
        if (!note.trim()) return;
        setSubmitting(true);
        const resp = await API.post(`users/${residentId}/notes`, {
            note: note.trim()
        });
        setSubmitting(false);
        if (resp.success) {
            toast.success('Note added');
            setNote('');
            onSuccess();
            onOpenChange(false);
        } else {
            toast.error(resp.message);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(val) => {
                if (!val) setNote('');
                onOpenChange(val);
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Historical Note</DialogTitle>
                    <DialogDescription>
                        Add context or supportive information to{' '}
                        {residentName}&apos;s profile
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="add-note">Note</Label>
                        <Textarea
                            id="add-note"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Add contextual information, support plans, or important updates..."
                            rows={4}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => void handleSubmit()}
                        disabled={submitting || !note.trim()}
                        className="bg-[#556830] hover:bg-[#203622]"
                    >
                        Add Note
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
