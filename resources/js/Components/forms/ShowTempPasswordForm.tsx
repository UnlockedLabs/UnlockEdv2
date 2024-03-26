import { CloseX } from "../inputs/CloseX";

export interface TempPasswordProps {
    tempPassword: string;
    onClose: () => void;
}
export default function ShowTempPasswordForm({
    tempPassword,
    onClose,
}: TempPasswordProps) {
    return (
        <div>
            <CloseX close={() => onClose()} />
            <h4 className="font-bold text-secondary">
                <br />
                <p>{tempPassword}</p>
            </h4>
            <p className="py-4"></p>
        </div>
    );
}
