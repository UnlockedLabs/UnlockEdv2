import { useEffect, useRef, useState } from "react";

export default function ClampedText({
    as: Component = "div",
    children,
    lines = 2,
    className = "",
}: {
    as?: React.ElementType;
    children: React.ReactNode;
    lines?: number;
    className?: string;
}) {
    const textRef = useRef<HTMLElement>(null);
    const [isClamped, setIsClamped] = useState(false);

    const checkClamping = () => {
        if (textRef.current) {
            const isContentClamped =
                textRef.current.scrollHeight > textRef.current.clientHeight ||
                textRef.current.scrollWidth > textRef.current.clientWidth;
            setIsClamped(isContentClamped);
        }
    };

    useEffect(() => {
        checkClamping();
        window.addEventListener("resize", checkClamping);
        return () => {
            window.removeEventListener("resize", checkClamping);
        };
    }, [children]);

    return (
        <Component ref={textRef} className={`line-clamp-${lines} overflow-hidden ${className}`} title={isClamped ? (typeof children === "string" ? children : "") : ""}>
            {children}
        </Component>
    );
}