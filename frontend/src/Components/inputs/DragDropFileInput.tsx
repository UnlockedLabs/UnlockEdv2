import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';

interface DragDropFileInputProps {
    onFileSelect: (file: File | null) => void;
    acceptedFileTypes: string;
    maxSizeInMB?: number;
    disabled?: boolean;
    currentFile?: File | null;
}

export function DragDropFileInput({
    onFileSelect,
    acceptedFileTypes,
    maxSizeInMB = 10,
    disabled = false,
    currentFile = null
}: DragDropFileInputProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateFile = (file: File): string | null => {
        const acceptedTypes = acceptedFileTypes
            .split(',')
            .map((type) => type.trim());
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!acceptedTypes.includes(fileExtension)) {
            return `Only ${acceptedFileTypes} files are supported`;
        }

        const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
        if (file.size > maxSizeInBytes) {
            return `File size must be less than ${maxSizeInMB}MB`;
        }

        return null;
    };

    const handleFile = (file: File) => {
        const validationError = validateFile(file);
        if (validationError) {
            setError(validationError);
            onFileSelect(null);
            return;
        }

        setError(null);
        onFileSelect(file);
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (!disabled) {
            setIsDragOver(true);
        }
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);

        if (disabled) return;

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    };

    const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    };

    const handleClick = () => {
        if (!disabled && fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleRemoveFile = () => {
        setError(null);
        onFileSelect(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="w-full">
            <div
                className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${
                        isDragOver && !disabled
                            ? 'border-teal-3 bg-teal-1'
                            : 'border-grey-2 hover:border-grey-3'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    ${error ? 'border-red-3 bg-red-1' : ''}
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleClick}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={acceptedFileTypes}
                    onChange={handleFileInputChange}
                    className="hidden"
                    disabled={disabled}
                />

                <div className="flex flex-col items-center gap-4">
                    <CloudArrowUpIcon className="w-16 h-16 text-grey-3" />

                    {currentFile ? (
                        <div className="text-center">
                            <p className="body font-semibold text-teal-4">
                                {currentFile.name}
                            </p>
                            <p className="body-small text-grey-4">
                                {(currentFile.size / 1024).toFixed(1)} KB
                            </p>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveFile();
                                }}
                                className="mt-2 body-small text-red-3 hover:text-red-4 underline"
                            >
                                Remove file
                            </button>
                        </div>
                    ) : (
                        <div className="text-center">
                            <p className="body text-grey-4 mb-2">
                                Drag and drop your CSV file here, or
                            </p>
                            <span className="button-outline-sm">
                                Choose File
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {error && <p className="body-small text-red-3 mt-2">{error}</p>}

            <p className="body-small text-grey-4 mt-2">
                Only {acceptedFileTypes} files are supported
            </p>
        </div>
    );
}
