export default function SortByPills({
    selected,
    label,
    updateSort
}: {
    selected: boolean;
    label: { name: string; value: string };
    updateSort: (value: string) => void;
}) {
    return (
        <div
            className={`${selected ? `bg-teal-1 border-2 border-black shadow-md` : `bg-grey-1`} px-3 py-1 rounded-2xl cursor-pointer body`}
            onClick={() => updateSort(label.value)}
        >
            {label.name}
        </div>
    );
}
