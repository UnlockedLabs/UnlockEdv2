export default function TealPill(props: {
    children: string | React.ReactElement;
}) {
    return (
        <p className="catalog-pill bg-[#B0DFDA] text-[#006059]">
            {props.children}
        </p>
    );
}
