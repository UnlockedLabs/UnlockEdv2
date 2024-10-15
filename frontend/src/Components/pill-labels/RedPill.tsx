export default function RedPill(props: { children: string }) {
    return (
        <p className="catalog-pill bg-[#FFDFDF] text-[#CA0000]">
            {props.children}
        </p>
    );
}
