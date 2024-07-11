import axios from "axios";
import { useEffect, useState } from "react";
import { ToastState } from "../Toast";
import { ProviderUser } from "@/common";
import { User } from "@/types";
import { CloseX } from "../inputs/CloseX";

interface Props {
  externalUser: ProviderUser;
  providerId: number;
  onSubmit: (msg: string, err: ToastState) => void;
  onCancel: () => void;
}

export default function MapUserForm({
  externalUser,
  providerId,
  onSubmit,
  onCancel,
}: Props) {
  const [errorMessage, setErrorMessage] = useState("");
  const [usersToMap, setUsersToMap] = useState<User[]>([]);
  const [totalUnmapped, setTotalUnmapped] = useState<User[]>([]);
  const [displayUsers, setDisplayUsers] = useState<User[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const usersPerPage = 5;

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleUserSelection = (userId: number) => {
    setSelectedUser(userId);
  };

  const handleSubmit = async (userId: number) => {
    try {
      setErrorMessage("");
      const response = await axios.post(
        `/api/provider-platforms/${providerId}/map-user/${userId}`,
        externalUser,
      );

      if (response.status !== 201) {
        onSubmit("", ToastState.error);
      }
      onSubmit(
        "User created successfully with temporary password",
        ToastState.success,
      );
    } catch (error: any) {
      setErrorMessage(error.response.data.message);
      onSubmit("Failed to map user", ToastState.error);
      return;
    }
  };

  function handleGetAllUnmappedUsers() {
    if (usersToMap.length === totalUnmapped.length) {
      return;
    }
    if (displayUsers.length < totalUnmapped.length) {
      totalUnmapped.length === 0
        ? onSubmit("No unmapped users in UnlockEd", ToastState.error)
        : setDisplayUsers(totalUnmapped);
    } else {
      setDisplayUsers(usersToMap);
    }
  }

  useEffect(() => {
    async function fetchUsers() {
      try {
        const all = await axios.get(
          `/api/users?include=only_unmapped&provider_id=${providerId}`,
        );
        if (all.status !== 200) {
          onSubmit("failed to fetch users, please try again", ToastState.error);
          return;
        }
        setTotalUnmapped(all.data.data);
        const response = await axios.get(
          `/api/users?include=only_unmapped&provider_id=${providerId}&search=${externalUser.username}&search=${externalUser.email}`,
        );
        if (response.status !== 200) {
          onSubmit("Failed to fetch users", ToastState.error);
          return;
        }
        setUsersToMap(response.data.data);
        setDisplayUsers(response.data.data);
      } catch (error: any) {
        console.log(error);
        setErrorMessage(error);
        onSubmit("Failed to fetch users", ToastState.error);
        return;
      }
    }
    externalUser && fetchUsers();
  }, [externalUser]);

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = displayUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(displayUsers.length / usersPerPage);

  return (
    <div>
      <CloseX close={onCancel} />
      <div className="text-sm font-bold">
        <div className="text-sm">Provider Username:</div>
        <div className="text-sm text-primary">
          {externalUser?.username ?? errorMessage}
          <br />
        </div>
        <div className="text-sm">Provider Email:</div>
        <div className="text-sm text-primary">{externalUser?.email ?? ""}</div>
        <div>to UnlockEd Users:</div>
      </div>
      <button
        className="btn btn-sm btn-outline"
        onClick={handleGetAllUnmappedUsers}
        disabled={totalUnmapped.length === usersToMap.length}
      >
        {displayUsers.length !== totalUnmapped.length
          ? "see all"
          : "see search results"}
      </button>
      <div>
        {currentUsers.map((user) => (
          <div key={user.id} className="border px-4 py-2">
            <input
              type="radio"
              id={`${user.id}`}
              name="user"
              className="radio radio-primary"
              value={user.id}
              checked={selectedUser === user.id}
              onChange={() => handleUserSelection(user.id)}
            />
            <label htmlFor={`${user.id}`} className="ml-2">
              {user.username} - {user.name_first} {user.name_last} -{" "}
              {user.email}
            </label>
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <button
          className="btn btn-sm btn-circle"
          disabled={currentPage === 1}
          onClick={() => handlePageChange(currentPage - 1)}
        >
          Previous
        </button>
        <button
          className="btn btn-sm btn-circle"
          disabled={currentPage === totalPages}
          onClick={() => handlePageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
      <div>
        <br />
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          onClick={() => handleSubmit(selectedUser)}
          disabled={!selectedUser}
        >
          Map to student
        </button>
      </div>
    </div>
  );
}
