import { useNavigate } from "react-router-dom";
import { ProviderPlatform, ProviderPlatformState } from "@/common";
import {
  PencilSquareIcon,
  CheckCircleIcon,
  LinkIcon,
  UserGroupIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import TealPill from "./pill-labels/TealPill";
import YellowPill from "./pill-labels/YellowPill";
import OutcomePill from "./pill-labels/GreyPill";

export default function ProviderCard({
  provider,
  openEditProvider,
  oidcClient,
  showAuthorizationInfo,
}: {
  provider: ProviderPlatform;
  openEditProvider: Function;
  oidcClient: Function;
  showAuthorizationInfo: Function;
}) {
  const navigate = useNavigate();
  return (
    // <div className="">
    //   <div className="card card-compact bg-base-100 shadow-xl h-full">
    //     <figure className="h-1/2">
    //       <img src={cardImg} alt="" className="object-contain" />
    //     </figure>
    //     <div
    //       className={`inline-flex items-center px-4 py-2 dark:bg-gray-800 font-semibold text-xs text-white dark:text-gray-800 uppercase tracking-widest
    //                         ${
    //                           provider.state == "archived"
    //                             ? "bg-accent"
    //                             : provider.state == "disabled"
    //                               ? "bg-neutral"
    //                               : "bg-primary"
    //                         }`}
    //     >
    //       <span className="mx-auto">{provider.state}</span>
    //     </div>
    //     <div className="card-body flex flex-col gap-2 content-between">
    //       <div className="flex flex-row justify-between">
    //         <h2 className="card-title">{provider.name}</h2>
    //         <SecondaryButton
    //           className="gap-2"
    //           onClick={() => openEditProvider(provider)}
    //         >
    //           <PencilSquareIcon className="w-4" />
    //         </SecondaryButton>
    //       </div>
    //       <p>
    //         <span className="font-bold">Description: </span>
    //         {provider.description}
    //       </p>
    //       <p>
    //         <span className="font-bold">Type: </span>
    //         {provider.type}
    //       </p>
    //       <p>
    //         <span className="font-bold">External login registered: </span>
    //         {provider.oidc_id !== 0 ? "Yes" : "No"}
    //       </p>
    //       {provider.oidc_id !== 0 && (
    //         <p>
    //           <button
    //             className="btn btn-primary btn-xs"
    //             onClick={() => navigate(`/provider-users/${provider.id}`)}
    //           >
    //             Manage Provider
    //           </button>
    //         </p>
    //       )}
    //       {provider.oidc_id === 0 && (
    //         <button
    //           className="btn btn-primary btn-xs"
    //           onClick={() => oidcClient(provider)}
    //         >
    //           Register OIDC Client
    //         </button>
    //       )}
    //     </div>
    //   </div>
    // </div>
    <tr className="bg-base-teal card p-4 w-full grid-cols-4 justify-items-center">
      <td className="justify-self-start">{provider.name}</td>
      <td>
        {provider.oidc_id !== 0 ? (
          <CheckCircleIcon className="w-4" />
        ) : (
          <div className="w-4"></div>
        )}
      </td>
      <td>
        {/* TO DO: FINISH THIS */}
        {provider.state == ProviderPlatformState.ENABLED ? (
          <TealPill>enabled</TealPill>
        ) : provider.state == ProviderPlatformState.DISABLED ? (
          <OutcomePill outcome={null}>disabled</OutcomePill>
        ) : provider.state == ProviderPlatformState.ARCHIVED ? (
          <YellowPill>archived</YellowPill>
        ) : (
          <p>Status unavailable</p>
        )}
      </td>
      <td className="flex flex-row gap-3 justify-self-end">
        {provider.state !== ProviderPlatformState.ARCHIVED && (
          <>
            {provider.oidc_id !== 0 ? (
              <>
                <div className="tooltip" data-tip="Auth Info">
                  <InformationCircleIcon
                    className="w-4"
                    onClick={() => showAuthorizationInfo(provider)}
                  />
                </div>
                <div className="tooltip" data-tip="Manage Users">
                  <UserGroupIcon
                    className="w-4"
                    onClick={() => navigate(`/provider-users/${provider.id}`)}
                  />
                </div>
              </>
            ) : (
              <div className="tooltip" data-tip="Register Provider">
                <LinkIcon
                  className="w-4 "
                  onClick={() => oidcClient(provider)}
                />
              </div>
            )}
            <div className="tooltip" data-tip="Edit Provider">
              <PencilSquareIcon
                className="w-4"
                onClick={() => openEditProvider(provider)}
              />
            </div>
          </>
        )}
      </td>
    </tr>
  );
}
