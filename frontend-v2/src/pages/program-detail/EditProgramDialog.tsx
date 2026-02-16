import { useState } from 'react';
import { mutate } from 'swr';
import { toast } from 'sonner';
import API from '@/api/api';
import {
    ProgramOverview,
    ProgramType,
    CreditType,
    FundingType,
    PgmType,
    ProgramCreditType
} from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    ALL_PROGRAM_TYPES,
    ALL_CREDIT_TYPES,
    ALL_FUNDING_TYPES
} from './constants';

interface EditProgramFormData {
    name: string;
    description: string;
    program_types: ProgramType[];
    credit_types: CreditType[];
    funding_type: FundingType;
    is_active: boolean;
}

interface EditProgramDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    program: ProgramOverview;
}

function buildInitialFormData(program: ProgramOverview): EditProgramFormData {
    return {
        name: program.name,
        description: program.description,
        program_types: program.program_types.map((pt) => pt.program_type),
        credit_types: program.credit_types.map((ct) => ct.credit_type),
        funding_type: program.funding_type,
        is_active: program.is_active
    };
}

export default function EditProgramDialog({
    open,
    onOpenChange,
    program
}: EditProgramDialogProps) {
    const [formData, setFormData] = useState<EditProgramFormData>(
        buildInitialFormData(program)
    );
    const [saving, setSaving] = useState(false);

    function handleCheckboxToggle<T>(
        field: 'program_types' | 'credit_types',
        value: T,
        checked: boolean
    ) {
        setFormData((prev) => {
            const current = prev[field] as T[];
            return {
                ...prev,
                [field]: checked
                    ? [...current, value]
                    : current.filter((item) => item !== value)
            };
        });
    }

    async function handleSave() {
        setSaving(true);
        const payload = {
            name: formData.name,
            description: formData.description,
            program_types: formData.program_types.map(
                (pt): PgmType => ({ program_type: pt })
            ),
            credit_types: formData.credit_types.map(
                (ct): ProgramCreditType => ({ credit_type: ct })
            ),
            funding_type: formData.funding_type,
            is_active: formData.is_active
        };
        const resp = await API.put('programs/' + program.id, payload);
        setSaving(false);
        if (resp.success) {
            toast.success('Program updated successfully');
            await mutate('/api/programs/' + program.id);
            onOpenChange(false);
        } else {
            toast.error(resp.message || 'Failed to update program');
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Program</DialogTitle>
                    <DialogDescription>
                        Make changes to the program details and categorization.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    <div>
                        <h4 className="text-sm text-foreground mb-3">
                            Basic Information
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="programName">
                                    Program Name
                                </Label>
                                <Input
                                    id="programName"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            name: e.target.value
                                        })
                                    }
                                />
                            </div>
                            <div>
                                <Label htmlFor="programDescription">
                                    Description
                                </Label>
                                <Textarea
                                    id="programDescription"
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            description: e.target.value
                                        })
                                    }
                                    rows={3}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border">
                        <h4 className="text-sm text-foreground mb-3">
                            Categorization
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Program Types</Label>
                                <div className="mt-2 space-y-2">
                                    {ALL_PROGRAM_TYPES.map((type) => (
                                        <label
                                            key={type}
                                            className="flex items-center gap-2 cursor-pointer"
                                        >
                                            <Checkbox
                                                checked={formData.program_types.includes(
                                                    type
                                                )}
                                                onCheckedChange={(checked) =>
                                                    handleCheckboxToggle(
                                                        'program_types',
                                                        type,
                                                        checked === true
                                                    )
                                                }
                                            />
                                            <span className="text-sm text-foreground">
                                                {type.replace(/_/g, ' ')}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <Label>Credit Types</Label>
                                <div className="mt-2 space-y-2">
                                    {ALL_CREDIT_TYPES.map((type) => (
                                        <label
                                            key={type}
                                            className="flex items-center gap-2 cursor-pointer"
                                        >
                                            <Checkbox
                                                checked={formData.credit_types.includes(
                                                    type
                                                )}
                                                onCheckedChange={(checked) =>
                                                    handleCheckboxToggle(
                                                        'credit_types',
                                                        type,
                                                        checked === true
                                                    )
                                                }
                                            />
                                            <span className="text-sm text-foreground">
                                                {type}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <Label>Funding Type</Label>
                                <Select
                                    value={formData.funding_type}
                                    onValueChange={(value) =>
                                        setFormData({
                                            ...formData,
                                            funding_type: value as FundingType
                                        })
                                    }
                                >
                                    <SelectTrigger className="mt-2">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ALL_FUNDING_TYPES.map((ft) => (
                                            <SelectItem key={ft} value={ft}>
                                                {ft.replace(/_/g, ' ')}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Status</Label>
                                <Select
                                    value={
                                        formData.is_active
                                            ? 'active'
                                            : 'inactive'
                                    }
                                    onValueChange={(value) =>
                                        setFormData({
                                            ...formData,
                                            is_active: value === 'active'
                                        })
                                    }
                                >
                                    <SelectTrigger className="mt-2">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">
                                            Active
                                        </SelectItem>
                                        <SelectItem value="inactive">
                                            Inactive
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="border-gray-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-[#556830] hover:bg-[#203622] text-white"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
