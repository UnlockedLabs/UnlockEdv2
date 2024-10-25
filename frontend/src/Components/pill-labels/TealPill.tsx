export default function TealPill(props: { children: string }) {
    return (
        <p className="catalog-pill bg-[#B0DFDA] text-[#006059]">
            {props.children}
        </p>
    );
}
