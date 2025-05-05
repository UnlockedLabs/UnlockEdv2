import { CloseX } from '../inputs/CloseX';

export default function ConfirmImportAllUsersForm({
    onCancel,
    onSuccess
}: {
    onCancel: () => void;
    onSuccess: () => void;
}) {
    return (
        <div>
            <CloseX close={() => onCancel()} />
            <p className="py-4">
                Are you sure you would like to import all users?
            </p>
            <form method="dialog" className="flex flex-row justify-between">
                <button className="button-grey" onClick={() => onCancel()}>
                    Cancel
                </button>
                <button
                    className="button"
                    onClick={() => {
                        onSuccess();
                    }}
                >
                    Confirm
                </button>
            </form>
        </div>
    );
}
