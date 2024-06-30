import { useState } from "react";
import { CloseX } from "../inputs";
import { UserImports } from "@/common";

interface ImportedUserProps {
  users: UserImports[];
  onExit: () => void;
}

const PaginatedUserTable = ({ users, onExit }: ImportedUserProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 5;
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(users.length / usersPerPage);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <div className="p-4">
      <CloseX close={onExit} />
      <div className="text-sm font-bold mb-4">Imported Users</div>
      <div className="overflow-x-auto">
        <table className="table table-xs table-auto w-full">
          <thead>
            <tr className="bg-gray-200">
              <th className="px-4 py-2">Username</th>
              <th className="px-4 py-2">Temp Password</th>
              <th className="px-4 py-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {currentUsers.map((user, idx) => (
              <tr key={idx} className="border-b">
                <td className="px-4 py-2">{user.username}</td>
                <td className="px-4 py-2">{user.temp_password ?? "n/a"}</td>
                <td className="px-4 py-2">{user.error ?? "n/a"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between mt-4">
        <button
          className="btn btn-sm btn-circle"
          disabled={currentPage === 1}
          onClick={() => handlePageChange(currentPage - 1)}
        >
          Previous
        </button>
        <span className="text-sm">
          Page {currentPage} of {totalPages}
        </span>
        <button
          className="btn btn-sm btn-circle"
          disabled={currentPage === totalPages}
          onClick={() => handlePageChange(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default PaginatedUserTable;
