import { Category, Link, Resource, ServerResponse } from "@/common";
import Error from "@/Pages/Error";
import useSWR from "swr";
import KolibriImg from "../../public/kolibri-card-cover.png";
import WikiImg from "../../public/wikipedia.png";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

const ExternalLink = ({ children, url }: { children: any; url: string }) => {
  return (
    <a
      className="flex gap-2 body-small text-body-text items-center"
      href={url}
      target="_blank"
    >
      <ArrowTopRightOnSquareIcon className="w-4" />
      {children}
    </a>
  );
};

// this isnt best practice but this is just a temp solution so will change in future & creat a component if need be
const KolibriCard = () => {
  return (
    <div className="card card-compact bg-base-teal overflow-hidden">
      <img
        src={KolibriImg}
        alt="Kolibri logo"
        className="h-[105px] object-cover"
      />
      <div className="card-body gap-2">
        <h3 className="card-title text-sm">Kolibri</h3>
        <p className="body-small">
          Kolibri provides an extensive library of educational content suitable
          for all learning levels.
        </p>
        {/* Temporary-- replace with external link to Kolibri */}
        <ExternalLink url="https://learningequality.org/kolibri/">
          Explore Kolibri's Content
        </ExternalLink>
      </div>
    </div>
  );
};

const WikiCard = () => {
  return (
    <div className="card card-compact bg-base-teal overflow-hidden">
      <div className="h-[105px] bg-[#D9D9D9] flex content-center justify-center">
        <img src={WikiImg} alt="Wikipedia logo" />
      </div>
      <div className="card-body gap-2">
        <h3 className="card-title text-sm">Wikipedia</h3>
        <p className="body-small">
          Wikipedia offers a vast collection of articles covering a wide range
          of topics across various academic disciplines.
        </p>
        {/* Temporary-- replace with external link to Wiki */}
        <ExternalLink url="https://www.wikipedia.org/">
          Explore Wikipedia's Content
        </ExternalLink>
      </div>
    </div>
  );
};

const ResourcesCard = ({ resource }: { resource: Resource }) => {
  return (
    <div className="card card-compact bg-base-teal overflow-hidden">
      <div className="card-body gap-3">
        <h3 className="card-title text-sm !mb-0">{resource.name}</h3>
        {resource.links.map((link: Link) => {
          const [title, url] = Object.entries(link)[0];
          return (
            <ExternalLink key={url} url={url}>
              {title}
            </ExternalLink>
          );
        })}
      </div>
    </div>
  );
};

export default function ResourcesSideBar() {
  const { data, isLoading, error } =
    useSWR<ServerResponse<any>>("/api/left-menu");

  if (isLoading) return <div>Loading...</div>;
  if (error) return <Error />;

  return (
    <div className="w-[409px] min-[1400px]:min-w-[409px] bg-background py-4 px-9">
      <div className="p-4 space-y-4">
        <h2>Open Content</h2>
        <KolibriCard />
        <WikiCard />
      </div>
      <div className="p-4 space-y-4">
        <h2>Resources</h2>
        <div className="flex flex-col gap-4">
          {data.data.map((category: Category, index: number) => {
            return (
              <ResourcesCard
                key={category.id + " " + index}
                resource={category}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
