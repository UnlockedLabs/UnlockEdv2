import { UseFormReset } from 'react-hook-form';

interface ResetButtonProps {
    reset: UseFormReset<any>; // eslint-disable-line
}
export function ResetButton({ reset }: ResetButtonProps) {
    return (
        <label className="form-control pt-4">
            <button
                type="button"
                className="btn btn-primary"
                onClick={() => reset()}
            >
                Clear
            </button>
        </label>
    );
}
