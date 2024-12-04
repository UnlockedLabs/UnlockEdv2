export default function SortByPills({
    label,
    updateSort,
    isSelected
}: {
    label: { name: string; value: string };
<<<<<<< HEAD
    updateSort: (value: string) => Promise<void>;
    isSelected: boolean;
||||||| parent of ccdef3a (feat: add global sort order for admins in helpful-links)
    updateSort: (value: string) => void;
=======
    updateSort: (value: string) => void;
    isSelected: boolean;
>>>>>>> ccdef3a (feat: add global sort order for admins in helpful-links)
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
