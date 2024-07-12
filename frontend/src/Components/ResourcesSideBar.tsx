import { Link, Resource, ServerResponse } from "@/common";
import Error from "@/Pages/Error";
import useSWR from "swr";
import KolibriImg from "../../public/kolibri-card-cover.png";
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

const KolibriCard = () => {
  return (
    <div className="card card-compact bg-base-teal overflow-hidden">
      <img src={KolibriImg} alt="Kolibri logo" />
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

const ResourcesCard = ({ resource }: { resource: Resource }) => {
  return (
    <div className="card card-compact bg-base-teal overflow-hidden">
      <div className="card-body gap-3">
        <h3 className="card-title text-sm !mb-0">{resource.name}</h3>
        {resource.links.map((link: Link) => {
          const [title, url] = Object.entries(link)[0];
          return <ExternalLink url={url}>{title}</ExternalLink>;
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
  console.log(data);

  return (
    <div className="w-[409px] min-[1400px]:min-w-[409px] bg-background flex flex-col gap-4 py-4 px-9">
      <div className="p-4 space-y-4">
        <h2>Open Content</h2>
        <KolibriCard />
      </div>
      <div className="p-4 space-y-4">
        <h2>Resources</h2>
        <div className="flex flex-col gap-4">
          {data.data.map((category) => {
            return <ResourcesCard resource={category} />;
          })}
        </div>
      </div>
    </div>
  );
}
