import { JSX } from "react";
import { CloseX } from "../inputs";

interface ImportedUserProps {
  users: ImportUserResponse[];
  onExit: () => void;
}
export interface ImportUserResponse {
  username: string;
  temp_password: string;
  error: string;
}
export default function ShowImportedUsers({
  users,
  onExit,
}: ImportedUserProps): JSX.Element {
  return (
    <div>
      <CloseX close={onExit} />
      <div className="text-lg font-bold">
        Map Provider User to UnlockEd User
      </div>
      <table className="table-auto">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2">Username</th>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Temp Password</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.username}>
              <td className="border px-4 py-2">{user.username}</td>
              <td className="border px-4 py-2">{user.temp_password}</td>
              <td className="border px-4 py-2">{user.error}</td>
            </tr>
          ))}
          ;
        </tbody>
      </table>
    </div>
  );
}
