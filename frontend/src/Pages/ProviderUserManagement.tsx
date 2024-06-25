import { useEffect, useRef, useState } from "react";
import axios from "axios";
import AuthenticatedLayout from "../Layouts/AuthenticatedLayout";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/20/solid";
import { useParams } from "react-router-dom";
import { ProviderPlatform, ProviderUser } from "../common";
import PageNav from "../Components/PageNav";
import Toast, { ToastState } from "../Components/Toast";
import Modal, { ModalType } from "../Components/Modal";
import { useAuth } from "../AuthContext";
import MapUserForm from "@/Components/forms/MapUserForm";
import PrimaryButton from "@/Components/PrimaryButton";
import ShowImportedUsers, {
  ImportUserResponse,
} from "@/Components/forms/ShowImportedUsers";
import Pagination from "@/Components/Pagination";

export default function ProviderUserManagement() {
  const auth = useAuth();
  const mapUserModal = useRef<null | HTMLDialogElement>(null);
  const importedUsersModal = useRef<null | HTMLDialogElement>(null);
  const [displayToast, setDisplayToast] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [usersToImport, setUsersToImport] = useState<ProviderUser[]>([]);
  const [userToMap, setUserToMap] = useState<null | ProviderUser>(null);
  const [perPage, setPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const { providerId } = useParams();
  const [sortBy, setSortBy] = useState("asc");
  const [provider, setProvider] = useState<ProviderPlatform | null>(null);
  const [providerUsers, setProviderUsers] = useState<ProviderUser[]>([]);
  const [importedUsers, setImportedUsers] = useState<ImportUserResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const [toast, setToast] = useState({
    state: ToastState.null,
    message: "",
    reset: () => {},
  });

  const sortData = (sortBy: string) => {
    return setProviderUsers(
      providerUsers.sort((a, b) => {
        if (sortBy == "asc") {
          setSortBy("asc");
          return a.name_first.localeCompare(b.name_first);
        } else {
          setSortBy("desc");
          return b.name_first.localeCompare(a.name_first);
        }
      }),
    );
  };

  const paginatedData = () => {
    const offset = (currentPage - 1) * perPage;
    return providerUsers.slice(offset, offset + perPage);
  };

  const changePage = (page: number) => {
    setCurrentPage(page);
  };

  const showToast = (message: string, state: ToastState) => {
    setToast({
      state,
      message,
      reset: () => {
        setToast({
          state: ToastState.success,
          message: "",
          reset: () => {
            setDisplayToast(false);
          },
        });
      },
    });
    setDisplayToast(true);
  };

  async function handleImportAllUsers() {
    let ans = prompt(
      "Are you sure you want to import all users from this provider? (yes/no)",
    );
    if (ans != "yes") {
      return;
    }
    try {
      let res = await axios.post(
        `/api/actions/provider-platforms/${providerId}/import-users`,
      );
      if (res.status === 200) {
        showToast("Users imported successfully", ToastState.success);
        window.location.reload();
      }
    } catch (error: any) {
      setError(true);
      showToast("Failed to import users", ToastState.error);
    }
  }

  async function handleImportSelectedUsers() {
    let res = await axios.post(
      `/api/provider-platforms/${providerId}/users/import`,
      { users: usersToImport },
    );
    if (res.status === 200) {
      showToast(res.data.message, ToastState.success);
      setImportedUsers(res.data.data);
      importedUsersModal.current?.showModal();
    }
  }

  function handleChangeUsersPerPage(e: React.ChangeEvent<HTMLSelectElement>) {
    setPerPage(parseInt(e.target.value));
  }

  function handleSubmitMapUser(msg: string, toastState: ToastState) {
    showToast(msg, toastState);
    mapUserModal.current?.close();
  }

  function handleCloseImportedUsers() {
    importedUsersModal.current?.close();
    setImportedUsers([]);
  }

  function handleCloseMapUser() {
    mapUserModal.current?.close();
    setUserToMap(null);
  }

  async function handleMapUser(user: ProviderUser) {
    setUserToMap(user);
    mapUserModal.current?.showModal();
  }

  function handleAddImportUser(user: ProviderUser) {
    if (usersToImport.includes(user)) {
      setUsersToImport(usersToImport.filter((u) => u !== user));
    } else {
      setUsersToImport([...usersToImport, user]);
    }
  }

  useEffect(() => {
    const getData = async () => {
      try {
        const userResp = await axios.get(
          `/api/actions/provider-platforms/${providerId}/get-users`,
        );
        if (userResp.status === 200) {
          setProviderUsers(userResp.data.data);
        }
        const res = await axios.get(`/api/provider-platforms/${providerId}`);
        if (res.status === 200) {
          setProvider(res.data.data);
          setIsLoading(false);
        }
      } catch (error: any) {
        showToast("Failed to fetch provider users", ToastState.error);
      }
    };
    getData();
  }, []);

  return (
    <AuthenticatedLayout title="Users">
      <PageNav
        user={auth.user!}
        path={["Provider Platforms", "Provider User Management"]}
      />
      <div className="flex flex-col space-y-6 overflow-x-auto rounded-lg p-4">
        <div className="flex justify-between">
          <input
            type="text"
            placeholder="Search..."
            className="input input-bordered w-full max-w-xs input-sm"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="flex justify-between">
          <PrimaryButton
            onClick={() => handleImportAllUsers()}
            disabled={provider?.has_import}
          >
            Import All Users
          </PrimaryButton>
          <PrimaryButton
            onClick={() => handleImportSelectedUsers()}
            disabled={usersToImport.length === 0}
          >
            Import Selected Users
          </PrimaryButton>
        </div>
        <table className="table-xs">
          <thead>
            <tr className="border-gray-600">
              <th className="flex">
                <span>Name</span>
                {sortBy == "asc" ? (
                  <ChevronDownIcon
                    className="h-4 text-accent cursor-pointer"
                    onClick={() => sortData("desc")}
                  />
                ) : (
                  <ChevronUpIcon
                    className="h-4 text-accent cursor-pointer"
                    onClick={() => sortData("asc")}
                  />
                )}
              </th>
              <th>Username</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading &&
              !error &&
              providerUsers.length != 0 &&
              paginatedData().map((user: any) => {
                return (
                  <tr key={user.external_user_id} className="border-gray-600">
                    <td> {user.name_first + "  " + user.name_last} </td>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>
                      <div
                        className="tooltip"
                        data-tip="import user into platform"
                      >
                        <div className="form-control">
                          <label className="label cursor-pointer gap-2">
                            Import User
                            <input
                              type="checkbox"
                              className="checkbox"
                              onChange={() => handleAddImportUser(user)}
                            />
                          </label>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div
                        className="tooltip"
                        data-tip="Associate user with existing account"
                      >
                        <a className="flex justify-start cursor-pointer">
                          <button
                            onClick={() => handleMapUser(user)}
                            className="btn btn-xs btn-primary"
                          >
                            Map User
                          </button>
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        <div className="flex flex-col justify-center">
          <Pagination
            meta={{
              current_page: currentPage,
              total: providerUsers.length,
              per_page: perPage,
              last_page: providerUsers.length / perPage,
            }}
            setPage={changePage}
          />
          <div className="flex-col-1">
            Users per page:
            <br />
            {!isLoading && providerUsers.length != 0 && (
              <select
                className="select select-none selext-sm select-bordered"
                value={perPage}
                onChange={handleChangeUsersPerPage}
              >
                {[10, 15, 20, 30].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        {error && (
          <span className="text-center text-error">Failed to load users.</span>
        )}
        {!isLoading && !error && providerUsers.length == 0 && (
          <span className="text-center text-warning">No results</span>
        )}
      </div>
      {provider && (
        <Modal
          ref={mapUserModal}
          type={ModalType.Associate}
          item="User"
          form={
            <MapUserForm
              onSubmit={handleSubmitMapUser}
              externalUser={userToMap}
              onCancel={handleCloseMapUser}
              providerId={parseInt(providerId)}
            />
          }
        />
      )}
      {importedUsers.length > 0 && (
        <Modal
          ref={importedUsersModal}
          type={ModalType.View}
          item="Imported Users"
          form={
            <ShowImportedUsers
              users={importedUsers}
              onExit={() => handleCloseImportedUsers()}
            />
          }
        />
      )}
      {/* Toasts */}
      {displayToast && <Toast {...toast} />}
    </AuthenticatedLayout>
  );
}
