import { CloseX } from "../inputs/CloseX";

export interface TempPasswordProps {
    tempPassword: string;
    userName: string;
    onClose: () => void;
}
export default function ShowTempPasswordForm({
    tempPassword,
    userName,
    onClose,
}: TempPasswordProps) {
    return (
        <div>
            <CloseX close={() => onClose()} />
            <p className="py-4">
                You have successfully reset {userName}'s password.
            </p>
            <div className="flex flex-row">
                <div className="stats shadow mx-auto">
                    <div className="stat">
                        <div className="stat-title">New Temporary Password</div>
                        <div className="stat-value">{tempPassword}</div>
                    </div>
                </div>
            </div>
            <p className="py-4"></p>
        </div>
    );
}
