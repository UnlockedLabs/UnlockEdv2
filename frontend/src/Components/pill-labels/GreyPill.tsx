export default function GreyPill(props: { children?: string }) {
    return (
        <p className="catalog-pill bg-grey-1 text-body-text">
            {props.children}
        </p>
    );
}
