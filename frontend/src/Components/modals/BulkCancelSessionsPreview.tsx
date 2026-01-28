import React from 'react';
import { BulkCancelSessionsPreview as BulkCancelSessionsPreviewType } from '@/types/events';

interface BulkCancelSessionsPreviewProps {
    preview: BulkCancelSessionsPreviewType | null;
    showPreview: boolean;
}

export const BulkCancelSessionsPreview: React.FC<
    BulkCancelSessionsPreviewProps
> = ({ preview, showPreview }) => {
    if (!preview || !showPreview) {
        return null;
    }

    return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
            <h4 className="font-semibold text-yellow-800 mb-2">
                Cancellation Preview
            </h4>
            <div className="text-sm text-yellow-700 space-y-1">
                <p>
                    <strong>Total Sessions:</strong> {preview.sessionCount}
                </p>
                <p>
                    <strong>Classes Affected:</strong> {preview.classCount}
                </p>
                <p>
                    <strong>Students Affected:</strong> {preview.studentCount}
                </p>
                {preview.classes.length > 0 && (
                    <div className="mt-3">
                        <strong>Classes to be affected:</strong>
                        <ul className="list-disc list-inside mt-1">
                            {preview.classes.map((cls, index) => (
                                <li key={index}>
                                    {cls.className} ({cls.upcomingSessions}{' '}
                                    sessions, {cls.studentCount} students)
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};
