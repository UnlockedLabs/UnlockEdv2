import { CloseX } from "./inputs/CloseX";
import { OidcClient } from "@/common";

export default function NewOidcClientNotification({
  client,
  onClose,
}: {
  client: OidcClient;
  onClose: () => void;
}) {
  return (
    <div className="modal-content">
      <div className="modal-header">
        <p className="label-text text-lg outline-info-content font-semibold">
          OIDC Client Registration Successful
        </p>
        <CloseX close={() => onClose()} />
      </div>
      <div className="modal-body">
        <div className="text-warning font-semibold">
          Please make sure to save the following information. It will not be
          displayed again.
        </div>
        <br />
        <div className="label-text-alt text-md font-semibold">Client ID:</div>
        <div className="text-info">{client.client_id}</div>
        <br />
        <p className="font-semibold">Client Secret:</p>
        <div className="text-info">{client.client_secret}</div>
        <br />
        <p className="font-semibold">Redirect URL:</p>
        <div className="text-info">{client.redirect_uris}</div>
        <br />
        <p className="font-semibold">Scopes:</p>
        <div className="text-info">{client.scopes}</div>
      </div>
    </div>
  );
}
