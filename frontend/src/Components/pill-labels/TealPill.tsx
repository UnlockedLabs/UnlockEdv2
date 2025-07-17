export default function TealPill(props: {
    children: string | React.ReactElement;
}) {
    return (
        <div className="catalog-pill bg-[#B0DFDA] text-[#006059]">
            {props.children}
        </div>
    );
}
