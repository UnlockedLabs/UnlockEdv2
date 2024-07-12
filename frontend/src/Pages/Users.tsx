import { useRef, useState } from "react";
import useSWR from "swr";
import axios from "axios";

import AuthenticatedLayout from "../Layouts/AuthenticatedLayout";
import {
  ArrowPathRoundedSquareIcon,
  ArrowUpRightIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
} from "@heroicons/react/20/solid";
import { DEFAULT_ADMIN_ID, PaginatedResponse, User } from "../common";
import PageNav from "../Components/PageNav";
import AddUserForm from "../Components/forms/AddUserForm";
import EditUserForm from "../Components/forms/EditUserForm";
import Toast, { ToastState } from "../Components/Toast";
import Modal, { ModalType } from "../Components/Modal";
import DeleteForm from "../Components/DeleteForm";
import ResetPasswordForm from "../Components/forms/ResetPasswordForm";
import ShowTempPasswordForm from "../Components/forms/ShowTempPasswordForm";
import DropdownControl from "@/Components/inputs/DropdownControl";
import SearchBar from "../Components/inputs/SearchBar";
import { useAuth } from "../AuthContext";
import { useDebounceValue } from "usehooks-ts";
import Pagination from "@/Components/Pagination";

export default function Users() {
  const auth = useAuth();
  const addUserModal = useRef<null | HTMLDialogElement>(null);
  const editUserModal = useRef<null | HTMLDialogElement>(null);
  const resetUserPasswordModal = useRef<null | HTMLDialogElement>(null);
  const deleteUserModal = useRef<null | HTMLDialogElement>(null);
  const [displayToast, setDisplayToast] = useState(false);
  const [targetUser, setTargetUser] = useState<null | User>(null);
  const [tempPassword, setTempPassword] = useState<string>("");
  const showUserPassword = useRef<null | HTMLDialogElement>(null);
  const [toast, setToast] = useState({
    state: ToastState.null,
    message: "",
    reset: () => {},
  });

  const [searchTerm, setSearchTerm] = useState("");
  const searchQuery = useDebounceValue(searchTerm, 300);
  const [pageQuery, setPageQuery] = useState(1);
  const [sortQuery, setSortQuery] = useState("created_at DESC");
  const { data, mutate, error, isLoading } = useSWR(
    `/api/users?search=${searchQuery[0]}&page=${pageQuery}&order=${sortQuery}`
  );
  const userData = data as PaginatedResponse<User>;
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

  function resetModal() {
    setTimeout(() => {
      setTargetUser(null);
    }, 200);
  }

  const deleteUser = async () => {
    if (targetUser?.id === DEFAULT_ADMIN_ID) {
      showToast(
        "This is the primary administrator and cannot be deleted",
        ToastState.error
      );
      return;
    }
    try {
      const response = await axios.delete("/api/users/" + targetUser?.id);
      const toastType =
        response.status == 204 ? ToastState.success : ToastState.error;
      const message =
        response.status == 204
          ? "User deleted successfully"
          : response.statusText;
      deleteUserModal.current?.close();
      showToast(message, toastType);
      resetModal();
      mutate();
      return;
    } catch (err: any) {
      showToast("Unable to delete user, please try again", ToastState.error);
      return;
    }
  };

  const onAddUserSuccess = (pswd = "", msg: string, type: ToastState) => {
    showToast(msg, type);
    setTempPassword(pswd);
    addUserModal.current?.close();
    showUserPassword.current?.showModal();
    mutate();
  };

  const hanldleEditUser = () => {
    editUserModal.current?.close();
    resetModal();
    mutate();
  };

  const handleDeleteUserCancel = () => {
    deleteUserModal.current?.close();
    resetModal();
  };

  const handleResetPasswordCancel = (msg: string, err: boolean) => {
    const state = err ? ToastState.error : ToastState.success;
    if (msg === "" && !err) {
      resetUserPasswordModal.current?.close();
      resetModal();
      return;
    }
    showToast(msg, state);
    resetModal();
  };

  const handleDisplayTempPassword = (psw: string) => {
    setTempPassword(psw);
    resetUserPasswordModal.current?.close();
    showUserPassword.current?.showModal();
    showToast("Password Successfully Reset", ToastState.success);
  };

  const handleShowPasswordClose = () => {
    showUserPassword.current?.close();
    setTempPassword("");
    resetModal();
  };

  const handleChange = (newSearch: string) => {
    setSearchTerm(newSearch);
    setPageQuery(1);
  };

  return (
    <AuthenticatedLayout title="Users">
      <PageNav user={auth.user!} path={["Settings", "Users"]} />
      <div className="flex flex-col space-y-6 overflow-x-auto rounded-lg p-4">
        <div className="flex justify-between">
          <div className="flex flex-row gap-x-2">
            <SearchBar searchTerm={searchTerm} changeCallback={handleChange} />
            <DropdownControl
              label="Sort by"
              callback={setSortQuery}
              enumType={{
                "Name (A-Z)": "name_last asc",
                "Name (Z-A)": "name_last desc",
                "Account Created ↓ ": "created_at desc",
                "Account Created ↑ ": "created_at asc",
              }}
            />
          </div>

          <div className="tooltip tooltip-left" data-tip="Add User">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => addUserModal.current?.showModal()}
            >
              <UserPlusIcon className="h-4" />
            </button>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr className="border-gray-600">
              <th className="flex">
                <span>Name</span>
              </th>
              <th>Username</th>
              <th>Role</th>
              <th>Activity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading &&
              !error &&
              userData.data.map((user: any) => {
                return (
                  <tr key={user.id} className="border-gray-600">
                    <td>
                      {user.name_first} {user.name_last}
                    </td>
                    <td>{user.username}</td>
                    <td>{user.role}</td>
                    <td>
                      <div className="tooltip" data-tip="User Activity">
                        <a className="flex justify-start cursor-pointer">
                          <span>Today</span>
                          <ArrowUpRightIcon className="w-4 text-accent" />
                        </a>
                      </div>
                    </td>
                    <td>
                      <div className="flex space-x-2 text-accent cursor-pointer">
                        <div className="tooltip" data-tip="Edit User">
                          <PencilIcon
                            className="h-4"
                            onClick={() => {
                              setTargetUser(user);
                              editUserModal.current?.showModal();
                            }}
                          />
                        </div>
                        <div className="tooltip" data-tip="Reset Password">
                          <ArrowPathRoundedSquareIcon
                            className="h-4"
                            onClick={() => {
                              setTargetUser(user);
                              resetUserPasswordModal.current?.showModal();
                            }}
                          />
                        </div>
                        <div className="tooltip" data-tip="Delete User">
                          <TrashIcon
                            className="h-4"
                            onClick={() => {
                              setTargetUser(user);
                              deleteUserModal.current?.showModal();
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        {!isLoading && !error && data.data.length != 0 && (
          <Pagination meta={userData.meta} setPage={setPageQuery} />
        )}
        {error && (
          <span className="text-center text-error">Failed to load users.</span>
        )}
        {!isLoading && !error && data.data.length == 0 && (
          <span className="text-center text-warning">No results</span>
        )}
      </div>

      <Modal
        ref={addUserModal}
        type={ModalType.Add}
        item="User"
        form={<AddUserForm onSuccess={onAddUserSuccess} />}
      />
      <Modal
        ref={editUserModal}
        type={ModalType.Edit}
        item="User"
        form={
          targetUser ? (
            <EditUserForm onSuccess={hanldleEditUser} user={targetUser} />
          ) : (
            <div>No user defined!</div>
          )
        }
      />
      <Modal
        ref={deleteUserModal}
        type={ModalType.Delete}
        item="User"
        form={
          <DeleteForm
            item="User"
            onCancel={handleDeleteUserCancel}
            onSuccess={deleteUser}
          />
        }
      />
      <Modal
        ref={resetUserPasswordModal}
        type={`Reset Password`}
        item=""
        form={
          <ResetPasswordForm
            user={targetUser}
            onCancel={handleResetPasswordCancel}
            onSuccess={handleDisplayTempPassword}
          />
        }
      />
      <Modal
        ref={showUserPassword}
        type={`New Password`}
        item={""}
        form={
          <ShowTempPasswordForm
            tempPassword={tempPassword}
            userName={
              targetUser
                ? `${targetUser.name_first} ${targetUser.name_last}`
                : null
            }
            onClose={handleShowPasswordClose}
          />
        }
      />
      {/* Toasts */}
      {displayToast && <Toast {...toast} />}
    </AuthenticatedLayout>
  );
}
