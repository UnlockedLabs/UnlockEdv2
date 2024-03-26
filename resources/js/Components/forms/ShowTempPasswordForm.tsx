export interface TempPasswordProps {
    tempPassword: string;
    onClose: () => void;
}
export default function ShowTempPasswordForm({
    tempPassword,
    onClose,
}: TempPasswordProps) {
    return (
        <div className="card-normal">
            <h3 className="font-bold text-xl">
                <p>New Temporary Password:</p>
            </h3>
            <h4 className="font-bold text-l text-secondary">
                <br />
                <p>{tempPassword}</p>
            </h4>
            <p className="py-4"></p>
            <div className="modal-action">
                <button className="btn" onClick={onClose}>
                    Close
                </button>
            </div>
        </div>
    );
}
