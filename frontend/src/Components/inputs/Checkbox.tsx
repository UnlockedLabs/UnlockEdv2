interface CheckboxProps {
    label: string;
    interfaceRef: string;
    register: Function;
}

export default function Checkbox({
    label,
    interfaceRef,
    register,
}: CheckboxProps) {
    return (
        <div className="form-control">
            <label className="label cursor-pointer gap-2">
                <input
                    type="checkbox"
                    className="checkbox"
                    {...register(interfaceRef)}
                />
                <span className="label-text">Remember me</span>
            </label>
        </div>
    );
}
