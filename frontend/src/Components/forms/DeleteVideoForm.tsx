interface DeleteFormProps {
    item: string;
    onCancel: () => void;
    onSuccess: () => void;
}

export default function DeleteForm({
    item,
    onCancel,
    onSuccess
}: DeleteFormProps) {
    return (
        <div className="flex flex-col space-y-4">
            <p>Are you sure you want to delete this {item}?</p>
            <div className="flex space-x-2">
                <button className="btn btn-error" onClick={onSuccess}>
                    Delete
                </button>
                <button className="btn btn-secondary" onClick={onCancel}>
                    Cancel
                </button>
            </div>
        </div>
    );
}
