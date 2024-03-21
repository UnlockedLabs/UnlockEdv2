import { ProviderPlatform } from "@/common";
import SecondaryButton from "./SecondaryButton";
import { PencilSquareIcon } from "@heroicons/react/24/solid";

export default function ProviderCard({
    provider,
    openEditProvider,
}: {
    provider: ProviderPlatform;
    openEditProvider: Function;
}) {
    let cardImg = provider.icon_url;
    if (cardImg == null) {
        cardImg = "/" + provider.type + ".jpg";
    }
    return (
        <div className="">
            <div className="card card-compact bg-base-100 shadow-xl h-full">
                <figure className="h-1/2">
                    <img src={cardImg} alt="" className="object-contain" />
                </figure>
                <div
                    className={`inline-flex items-center px-4 py-2 dark:bg-gray-800 font-semibold text-xs text-white dark:text-gray-800 uppercase tracking-widest
                            ${
                                provider.state == "archived"
                                    ? "bg-accent"
                                    : provider.state == "disabled"
                                      ? "bg-neutral"
                                      : "bg-primary"
                            }`}
                >
                    <span className="mx-auto">{provider.state}</span>
                </div>
                <div className="card-body flex flex-col gap-2 content-between">
                    <div className="flex flex-row justify-between">
                        <h2 className="card-title">{provider.name}</h2>
                        <SecondaryButton
                            className="gap-2"
                            onClick={() => openEditProvider(provider)}
                        >
                            <PencilSquareIcon className="w-4" />
                        </SecondaryButton>
                    </div>
                    <p>
                        <span className="font-bold">Description: </span>
                        {provider.description}
                    </p>
                    <p>
                        <span className="font-bold">Type: </span>
                        {provider.type}
                    </p>
                </div>
            </div>
        </div>
    );
}
