interface DropdownControlProps {
  label?: string;
  callback: Function;
  enumType: Record<string, string>;
}

/* a dropdown that executes a callback function on change */
export function DropdownControl({
  label,
  callback,
  enumType,
}: DropdownControlProps) {
  return (
    <label className="form-control w-full">
      {label && (
        <div className="label">
          <span className="label-text">{label}</span>
        </div>
      )}
      <select
        className="select select-bordered"
        onChange={(e) => callback(e.target.value)}
      >
        {Object.entries(enumType).map(([key, value]) => (
          <option key={key} value={value}>
            {value}
          </option>
        ))}
      </select>
    </label>
  );
}
