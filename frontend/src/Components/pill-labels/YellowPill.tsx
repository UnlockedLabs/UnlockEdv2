export default function YellowPill(props: { children: string }) {
    return (
        <p className="catalog-pill bg-[#FFF3D4] text-[#ECAA00]">
            {props.children}
        </p>
    );
}
