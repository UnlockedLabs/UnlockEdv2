export default function LightGreenPill(props: { children: string }) {
    return (
        <p className="catalog-pill bg-[#DDFFCD] text-[#408D1C]">
            {props.children}
        </p>
    );
}
