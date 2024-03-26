import axios from "axios";
import { User } from "@/common";

interface ResetPasswordFormProps {
    onCancel: (message: string, is_err: boolean) => void;
    onSuccess: (psw: string) => void;
    user: User | null;
}

export default function ResetPasswordForm({
    user,
    onSuccess,
    onCancel,
}: ResetPasswordFormProps) {
    const getTempPassword = async () => {
        try {
            const response = await axios("/student-password", {
                method: "post",
                headers: { ContentType: "application/json" },
                data: { user_id: user?.id },
            });
            if (response.status !== 201) {
                onCancel("Failed to reset password", true);
                return;
            }
            onSuccess(response.data.data["password"]);
            return;
        } catch (error: any) {
            onCancel(error.response.data.message, true);
            return;
        }
    };

    return (
        <div className="card-normal">
            <h3 className="font-bold text-xl">
                <p>Reset User's Password?</p>
            </h3>
            <h4 className="font-bold text-l text-secondary">
                <br />
                <p>Note: Only for non-administrator accounts.</p>
            </h4>
            <p className="py-4"></p>
            <div className="modal-action">
                <button
                    className="btn btn-error"
                    onClick={() => {
                        getTempPassword();
                    }}
                >
                    Reset
                </button>
                <form method="dialog">
                    {/* if there is a button in form, it will close the modal */}
                    <button className="btn" onClick={() => onCancel("", false)}>
                        Close
                    </button>
                </form>
            </div>
        </div>
    );
}
