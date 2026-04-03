import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';
import API from '@/api/api';
import {
    Facility,
    ProgramOverview,
    ProgramType,
    CreditType,
    FundingType,
    PgmType,
    ProgramCreditType,
    ServerResponseMany
} from '@/types';
import { canSwitchFacility, useAuth } from '@/auth/useAuth';
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
    status: 'Available' | 'Inactive' | 'Archived';
    facilities: number[];
}

interface EditProgramDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    program: ProgramOverview;
}

function buildInitialFormData(program: ProgramOverview): EditProgramFormData {
    const status = program.archived_at
        ? 'Archived'
        : program.is_active
          ? 'Available'
          : 'Inactive';
    return {
        name: program.name,
        description: program.description,
        program_types: program.program_types.map((pt) => pt.program_type),
        credit_types: program.credit_types.map((ct) => ct.credit_type),
        funding_type: program.funding_type,
        status,
        facilities: program.facilities?.map((facility) => facility.id) ?? []
    };
}

export default function EditProgramDialog({
    open,
    onOpenChange,
    program
}: EditProgramDialogProps) {
    const { user } = useAuth();
    const isDeptAdminUser = user ? canSwitchFacility(user) : false;
    const [formData, setFormData] = useState<EditProgramFormData>(
        buildInitialFormData(program)
    );
    const [saving, setSaving] = useState(false);
    const { data: facilitiesResp } = useSWR<ServerResponseMany<Facility>>(
        isDeptAdminUser ? '/api/facilities?per_page=200' : null
    );
    const facilities = facilitiesResp?.data ?? [];

    useEffect(() => {
        if (!open) return;
        setFormData(buildInitialFormData(program));
    }, [open, program]);

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
        const currentStatus = program.archived_at
            ? 'Archived'
            : program.is_active
              ? 'Available'
              : 'Inactive';
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
            is_active: formData.status === 'Available'
        };
        if (isDeptAdminUser) {
            Object.assign(payload, { facilities: formData.facilities });
        }
        const resp = await API.patch('programs/' + program.id, payload);
        if (resp.success) {
            if (
                formData.status === 'Archived' &&
                currentStatus !== 'Archived'
            ) {
                const archiveResp = await API.patch<
                    {
                        updated?: boolean;
                        message?: string;
                    },
                    Record<string, unknown>
                >(`programs/${program.id}/status`, {
                    archived_at: new Date().toISOString(),
                    is_active: false
                });
                const archiveUpdated =
                    !Array.isArray(archiveResp.data) &&
                    archiveResp.data?.updated !== false;
                if (!archiveResp.success || !archiveUpdated) {
                    toast.error(
                        archiveResp.message || 'Unable to archive program'
                    );
                    setSaving(false);
                    return;
                }
            } else if (
                currentStatus === 'Archived' &&
                formData.status !== 'Archived'
            ) {
                const unarchiveResp = await API.patch<
                    {
                        updated?: boolean;
                        message?: string;
                    },
                    Record<string, unknown>
                >(`programs/${program.id}/status`, {
                    archived_at: null,
                    is_active: formData.status === 'Available'
                });
                const unarchiveUpdated =
                    !Array.isArray(unarchiveResp.data) &&
                    unarchiveResp.data?.updated !== false;
                if (!unarchiveResp.success || !unarchiveUpdated) {
                    toast.error(
                        unarchiveResp.message || 'Unable to update program status'
                    );
                    setSaving(false);
                    return;
                }
            }
            toast.success('Program updated successfully');
            await mutate('/api/programs/' + program.id);
            onOpenChange(false);
        } else {
            toast.error(resp.message || 'Failed to update program');
        }
        setSaving(false);
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
                        <h4 className="text-sm text-gray-700 mb-3">
                            Basic Information
                        </h4>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="programName">
                                    Program Name *
                                </Label>
                                <Input
                                    id="programName"
                                    placeholder="Program name"
                                    value={formData.name}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            name: e.target.value
                                        })
                                    }
                                    className="focus-visible:border-[#b3b3b3] focus-visible:ring-[#b3b3b3]/50"
                                />
                            </div>
                            <div>
                                <Label htmlFor="programDescription">
                                    Description
                                </Label>
                                <Textarea
                                    id="programDescription"
                                    placeholder="Brief description of the program"
                                    value={formData.description}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            description: e.target.value
                                        })
                                    }
                                    rows={2}
                                    className="focus-visible:border-[#b3b3b3] focus-visible:ring-[#b3b3b3]/50"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                        <h4 className="text-sm text-gray-700 mb-3">
                            Categorization
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Category (Program Types) *</Label>
                                <div className="mt-2 space-y-2">
                                    {ALL_PROGRAM_TYPES.map((type) => (
                                        <label
                                            key={type}
                                            className="flex items-center gap-2 cursor-pointer"
                                        >
                                            <Checkbox
                                                size="sm"
                                                className="rounded border-gray-400 bg-white data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white focus-visible:border-[#b3b3b3] focus-visible:ring-[#b3b3b3]/50"
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
                                            <span className="text-sm text-gray-700">
                                                {type.replace(/_/g, ' ')}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <Label>Credit Types *</Label>
                                <div className="mt-2 space-y-2">
                                    {ALL_CREDIT_TYPES.map((type) => (
                                        <label
                                            key={type}
                                            className="flex items-center gap-2 cursor-pointer"
                                        >
                                            <Checkbox
                                                size="sm"
                                                className="rounded border-gray-400 bg-white data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white focus-visible:border-[#b3b3b3] focus-visible:ring-[#b3b3b3]/50"
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
                                            <span className="text-sm text-gray-700">
                                                {type}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="col-span-2">
                                <Label>Funding Types *</Label>
                                <Select
                                    value={formData.funding_type}
                                    onValueChange={(value) =>
                                        setFormData({
                                            ...formData,
                                            funding_type: value as FundingType
                                        })
                                    }
                                >
                                    <SelectTrigger className="mt-2 focus-visible:border-[#b3b3b3] focus-visible:ring-[#b3b3b3]/50">
                                        <SelectValue placeholder="Select funding type" />
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

                            <div className="col-span-2">
                                <Label>Program Availability *</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(value) =>
                                        setFormData({
                                            ...formData,
                                            status: value as EditProgramFormData['status']
                                        })
                                    }
                                >
                                    <SelectTrigger className="mt-0 focus-visible:border-[#b3b3b3] focus-visible:ring-[#b3b3b3]/50">
                                        <SelectValue placeholder="Select program status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Available">
                                            Available
                                        </SelectItem>
                                        <SelectItem value="Inactive">
                                            Inactive
                                        </SelectItem>
                                        <SelectItem value="Archived">
                                            Archived
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500 mt-1">
                                    Available programs can accept new class
                                    enrollments. Inactive programs are
                                    temporarily paused. Archived programs are no
                                    longer offered.
                                </p>
                            </div>

                            {isDeptAdminUser && (
                                <div className="col-span-2">
                                    <Label htmlFor="facilities">
                                        Facilities Offered *
                                    </Label>
                                    <div className="mt-2 max-h-60 overflow-y-auto space-y-2">
                                        {facilities.map((facility) => (
                                            <label
                                                key={facility.id}
                                                className="flex items-center gap-2 cursor-pointer"
                                            >
                                                <Checkbox
                                                    checked={formData.facilities.includes(
                                                        facility.id
                                                    )}
                                                    onCheckedChange={(checked) => {
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            facilities: checked
                                                                ? [
                                                                      ...prev.facilities,
                                                                      facility.id
                                                                  ]
                                                                : prev.facilities.filter(
                                                                      (id) =>
                                                                          id !==
                                                                          facility.id
                                                                  )
                                                        }));
                                                    }}
                                                />
                                                <span className="text-sm text-gray-700">
                                                    {facility.name}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Select which facilities will offer this
                                        program. You can add more facilities later.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="border-gray-300 focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-[#556830] hover:bg-[#203622] text-white focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
                            onClick={() => void handleSave()}
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
