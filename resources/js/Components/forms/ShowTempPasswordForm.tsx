import { CloseX } from "../inputs/CloseX";

export interface TempPasswordProps {
    tempPassword: string;
    username: string;
    onClose: () => void;
}
export default function ShowTempPasswordForm({
    tempPassword,
    username,
    onClose,
}: TempPasswordProps) {
    return (
        <div className="card-normal">
            <button
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                onClick={() => {
                    onClose();
                }}
            >
                ✕
            </button>
            <h3 className="font-bold text-xl">
                <p>New Temporary Password for {username}:</p>
            </h3>
            <h4 className="font-bold text-l text-secondary">
                <br />
                <p>{tempPassword}</p>
            </h4>
            <p className="py-4"></p>
            <div className="modal-action">
                <form method="dialog">
                    <CloseX close={() => onClose()} />
                </form>
            </div>
        </div>
    );
}
