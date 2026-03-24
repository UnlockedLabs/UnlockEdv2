import { useState } from 'react';
import API from '@/api/api';
import {
    BulkUploadResponse,
    InvalidUserRow,
    ValidatedUserRow,
    ServerResponseOne,
    ToastState
} from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Upload, Download, AlertCircle, CheckCircle } from 'lucide-react';

interface BulkImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function BulkImportDialog({
    open,
    onOpenChange,
    onSuccess
}: BulkImportDialogProps) {
    const { toaster } = useToast();
    const [step, setStep] = useState<'upload' | 'validation'>('upload');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [validRows, setValidRows] = useState<ValidatedUserRow[]>([]);
    const [invalidRows, setInvalidRows] = useState<InvalidUserRow[]>([]);
    const [errorCsvData, setErrorCsvData] = useState<string | undefined>();
    const [validating, setValidating] = useState(false);
    const [creating, setCreating] = useState(false);

    const reset = () => {
        setStep('upload');
        setUploadedFile(null);
        setValidRows([]);
        setInvalidRows([]);
        setErrorCsvData(undefined);
    };

    const handleOpenChange = (value: boolean) => {
        if (!value) reset();
        onOpenChange(value);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) setUploadedFile(file);
    };

    const handleDownloadTemplate = () => {
        const csvContent =
            'First Name,Last Name,Username,Resident ID\nJohn,Doe,johndoe,R1001\n';
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'resident_import_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleValidateCSV = async () => {
        if (!uploadedFile) return;
        setValidating(true);
        const formData = new FormData();
        formData.append('file', uploadedFile);
        const response = (await API.post<BulkUploadResponse, FormData>(
            'users/bulk/upload',
            formData
        )) as ServerResponseOne<BulkUploadResponse>;
        setValidating(false);

        if (response.success) {
            setValidRows(response.data.valid_rows ?? []);
            setInvalidRows(response.data.invalid_rows ?? []);
            setErrorCsvData(response.data.error_csv_data);
            setStep('validation');
        } else {
            toaster(
                response.message ?? 'Failed to validate CSV',
                ToastState.error
            );
        }
    };

    const handleDownloadErrors = () => {
        if (!errorCsvData) return;
        const decoded = atob(errorCsvData);
        const blob = new Blob([decoded], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'import_errors.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleCreateAccounts = async () => {
        if (validRows.length === 0) return;
        setCreating(true);
        const response = await API.post<string, ValidatedUserRow[]>(
            'users/bulk/create',
            validRows
        );
        setCreating(false);

        if (response.success) {
            toaster(
                `${validRows.length} resident accounts created successfully`,
                ToastState.success
            );
            handleOpenChange(false);
            onSuccess();
        } else {
            toaster(
                response.message ?? 'Failed to create accounts',
                ToastState.error
            );
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Bulk Import Residents</DialogTitle>
                    <DialogDescription>
                        Import multiple resident accounts from a CSV file
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    {step === 'upload' ? (
                        <>
                            <Label
                                htmlFor="csv-upload"
                                className="block cursor-pointer"
                            >
                                <div
                                    className={`border-2 border-dashed rounded-lg p-8 transition-all ${
                                        uploadedFile
                                            ? 'border-green-500 bg-green-50 hover:bg-green-100'
                                            : 'border-gray-300 hover:border-[#556830] hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-6">
                                        {uploadedFile ? (
                                            <div className="bg-green-500 rounded-full p-3 flex-shrink-0">
                                                <CheckCircle className="size-8 text-white" />
                                            </div>
                                        ) : (
                                            <Upload className="size-12 text-gray-400 flex-shrink-0" />
                                        )}
                                        <div className="flex-1">
                                            <div
                                                className={`text-base font-medium block mb-2 ${
                                                    uploadedFile
                                                        ? 'text-green-700'
                                                        : 'text-[#556830]'
                                                }`}
                                            >
                                                {uploadedFile
                                                    ? 'File Selected'
                                                    : 'Choose CSV File'}
                                            </div>
                                            <Input
                                                id="csv-upload"
                                                type="file"
                                                accept=".csv"
                                                onChange={handleFileUpload}
                                                className="hidden"
                                            />
                                            {uploadedFile ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-green-900 text-lg">
                                                            {uploadedFile.name}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            document
                                                                .getElementById(
                                                                    'csv-upload'
                                                                )
                                                                ?.click();
                                                        }}
                                                        className="text-sm text-[#556830] hover:text-[#203622] underline font-medium"
                                                    >
                                                        Choose a different file
                                                    </button>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-500">
                                                    Upload a CSV file with
                                                    resident information
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Label>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <Download className="size-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <div className="font-medium text-sm text-blue-900 mb-1">
                                            Download Template
                                        </div>
                                        <p className="text-sm text-blue-800 mb-3">
                                            Use our template to ensure your CSV
                                            file is formatted correctly with all
                                            required fields.
                                        </p>
                                        <Button
                                            size="sm"
                                            onClick={handleDownloadTemplate}
                                            variant="outline"
                                            className="border-blue-300 text-blue-700 hover:bg-blue-100"
                                        >
                                            <Download className="size-4 mr-2" />
                                            Download Template
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <CheckCircle className="size-5 text-green-600" />
                                        <div className="font-medium text-green-900">
                                            Valid Entries
                                        </div>
                                    </div>
                                    <div className="text-2xl font-semibold text-green-700">
                                        {validRows.length}
                                    </div>
                                    <div className="text-xs text-green-600 mt-1">
                                        Ready to import
                                    </div>
                                </div>
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlertCircle className="size-5 text-red-600" />
                                        <div className="font-medium text-red-900">
                                            Invalid Entries
                                        </div>
                                    </div>
                                    <div className="text-2xl font-semibold text-red-700">
                                        {invalidRows.length}
                                    </div>
                                    <div className="text-xs text-red-600 mt-1">
                                        Need correction
                                    </div>
                                </div>
                            </div>

                            {invalidRows.length > 0 && (
                                <div className="border-2 border-red-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="size-5 text-red-600 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1">
                                            <div className="font-medium text-sm text-red-900 mb-1">
                                                Errors Found
                                            </div>
                                            <p className="text-sm text-gray-700 mb-3">
                                                {invalidRows.length > 3
                                                    ? `Showing first 3 of ${invalidRows.length} errors. Download the full error report to see all issues.`
                                                    : 'The following rows have errors:'}
                                            </p>

                                            <div className="space-y-2 mb-4">
                                                {invalidRows
                                                    .slice(0, 3)
                                                    .map((row, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="bg-gray-50 border border-gray-200 rounded p-3 text-sm"
                                                        >
                                                            <div className="font-medium text-gray-900 mb-1">
                                                                Row{' '}
                                                                {
                                                                    row.row_number
                                                                }
                                                                :{' '}
                                                                {
                                                                    row.first_name
                                                                }{' '}
                                                                {row.last_name}
                                                            </div>
                                                            <div className="text-red-700 text-xs">
                                                                {row.error_reasons.join(
                                                                    ', '
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>

                                            <Button
                                                size="sm"
                                                onClick={handleDownloadErrors}
                                                variant="outline"
                                                className="border-red-300 text-red-700 hover:bg-red-50"
                                            >
                                                <Download className="size-4 mr-2" />
                                                Download Full Error Report
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {invalidRows.length === 0 && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle className="size-5 text-green-600" />
                                        <div>
                                            <div className="font-medium text-sm text-green-900">
                                                All entries are valid!
                                            </div>
                                            <p className="text-sm text-green-700 mt-1">
                                                You can proceed to create{' '}
                                                {validRows.length} resident
                                                accounts.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    {step === 'upload' ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => handleOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => void handleValidateCSV()}
                                disabled={!uploadedFile || validating}
                                className="bg-[#556830] hover:bg-[#203622]"
                            >
                                {validating ? 'Validating...' : 'Validate CSV'}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setStep('upload');
                                    setValidRows([]);
                                    setInvalidRows([]);
                                    setErrorCsvData(undefined);
                                }}
                            >
                                Back
                            </Button>
                            <Button
                                onClick={() => void handleCreateAccounts()}
                                disabled={
                                    validRows.length === 0 || creating
                                }
                                className="bg-[#556830] hover:bg-[#203622]"
                            >
                                {creating
                                    ? 'Creating...'
                                    : `Create ${validRows.length} Accounts`}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
