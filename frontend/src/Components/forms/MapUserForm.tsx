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

  useEffect(() => {
    async function fetchUsers() {
      try {
        const response = await axios.get(
          `/api/users?include=only_unmapped&provider_id=${providerId}&search=${externalUser.name_last}`,
        );
        if (response.status !== 200) {
          onSubmit("Failed to fetch users", ToastState.error);
          return;
        }
        setUsersToMap(response.data.data);
      } catch (error: any) {
        console.log(error);
        setErrorMessage(error);
        onSubmit("Failed to fetch users", ToastState.error);
        return;
      }
    }
    externalUser && fetchUsers();
  }, [externalUser]);

  return (
    <div>
      <CloseX close={onCancel} />
      <div className="text-sm font-bold">
        <div className="text-sm">Provider Username:</div>
        <div className="text-sm text-primary">
          {externalUser?.username ?? errorMessage}
          <br />
        </div>
        <div className="text-sm">Provider Email: </div>{" "}
        <div className="text-sm text-primary"> {externalUser?.email ?? ""}</div>{" "}
        to UnlockEd User:
      </div>
      <table className="table-xs">
        <thead className="table-header-group">
          <tr>
            <th className="px-4 py-2">Username</th>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Map to student</th>
          </tr>
        </thead>
        <tbody>
          {externalUser &&
            usersToMap.map((user) => (
              <tr key={user.id}>
                <td className="border px-4 py-2">{user.username}</td>
                <td className="border px-4 py-2">
                  {user.name_first} {user.name_last}
                </td>
                <td className="border px-4 py-2">{user.email}</td>
                <td className="border px-4 py-2">
                  <button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    onClick={() => handleSubmit(user.id)}
                  >
                    Map
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
