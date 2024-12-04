export default function SortByPills({
    label,
    updateSort,
    isSelected
}: {
    label: { name: string; value: string };
    updateSort: (value: string) => void;
    isSelected: boolean;
}) {
    return (
        <div
            className={`${isSelected ? `bg-teal-1 border-2 border-black shadow-md` : `bg-grey-1`} px-3 py-1 rounded-2xl cursor-pointer body`}
            onClick={() => void updateSort(label.value)}
        >
            {label.name}
        </div>
    );
}
