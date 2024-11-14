import React from 'react';

import { EditableResourceCollection, ResourceLink } from '@/common';
import ULIComponent from '@/Components/ULIComponent.tsx';
import { TrashIcon } from '@heroicons/react/24/outline';
import ExternalLink from '@/Components/ExternalLink';

export default function ResourceCollectionCardWithActions({
    collection,
    selected,
    onResourceCollectionClick,
    onDeleteCollectionClick
}: {
    collection: EditableResourceCollection;
    selected: boolean;
    onResourceCollectionClick: (collection: EditableResourceCollection) => void;
    onDeleteCollectionClick: (collectionId: number) => void;
}) {
    const cardClasses = `card card-compact grow overflow-visible ${collection.isModified ? 'bg-pale-yellow' : 'bg-inner-background'} ${selected ? 'border border-dark-yellow' : ''}`;

    return (
        <div
            className={cardClasses}
            onClick={() => onResourceCollectionClick(collection)}
        >
            <div className="card-body gap-2">
                <div className="flex justify-between">
                    <h3 className="card-title text-sm">{collection.name}</h3>
                    <ULIComponent
                        dataTip={'Delete Collection'}
                        iconClassName={'self-start cursor-pointer'}
                        onClick={() => onDeleteCollectionClick(collection.id)}
                        icon={TrashIcon}
                    />
                </div>
                {collection.links.map((link: ResourceLink, index: number) => {
                    const [title, url] = Object.entries(link)[0];
                    return (
                        <ExternalLink key={index} url={url}>
                            {title}
                        </ExternalLink>
                    );
                })}
            </div>
        </div>
    );
}
