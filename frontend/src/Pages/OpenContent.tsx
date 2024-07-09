import PageNav from "@/Components/PageNav.tsx";
import { useAuth } from "../AuthContext";
import AuthenticatedLayout from "../Layouts/AuthenticatedLayout";

const OpenContent = () => {
  const { user } = useAuth();
  return (
    <AuthenticatedLayout title="Dashboard">
      <PageNav user={user!} path={["Dashboard", "Open Content"]} />
      <h1 className="text-5xl pb-20 mt-10 text-center">
        Available Open Content
      </h1>
      <div className="flex justify-center items-center space-x-4 mt-8">
        <div className="card w-1/4">
          <div className="card-body bg-base-teal p-6 mb-8">
            <a href="https://kolibri.staging.unlockedlabs.xyz">
              <img
                src="kolibri.webp"
                alt="Kolibri logo"
                width={150}
                height={175}
              />
              <h2 className="text-3xl mb-4">Kolibri</h2>
              <p>
                Kolibri provides an extensive library of educational content
                suitable for all learning levels. Our platform links directly to
                Kolibri to offer our students a wealth of learning resources.
              </p>
            </a>
          </div>
        </div>
        <div className="card w-1/4 bg-base-teal p-6">
          <img
            src="wikipedia.png"
            alt="wikipedia logo"
            width={150}
            height={175}
          />
          <h2 className="text-3xl mb-4">Wikipedia</h2>
          <p>
            Wikipedia offers a vast collection of articles covering a wide range
            of topics across various academic disciplines. Students can use
            Wikipedia to quickly access information, gain an overview of
            subjects, and explore related concepts.
          </p>
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default OpenContent;
