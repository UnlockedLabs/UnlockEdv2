import { CloseX } from '../Components/inputs/CloseX';

interface DeleteProps {
    item: string;
    onCancel: () => void;
    onSuccess: () => void;
}

export default function DeleteForm({ item, onCancel, onSuccess }: DeleteProps) {
    return (
        <div>
            <CloseX close={() => onCancel()} />
            <p className="py-4">
                Are you sure you would like to delete this {item.toLowerCase()}?
                <br /> This action cannot be undone.
            </p>
            <p className="py-4"></p>
            <form method="dialog" className="flex flex-row justify-between">
                <button className="btn" onClick={() => onCancel()}>
                    Cancel
                </button>
                <button
                    className="btn btn-error"
                    onClick={() => {
                        onSuccess();
                    }}
                >
                    Delete {item}
                </button>
            </form>
        </div>
    );
}
