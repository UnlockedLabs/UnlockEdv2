package handlers

import (
	"context"
	"fmt"
	"net/http"

	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"

	"github.com/UnlockedLabs/unlocked-contracts/identity"
	"github.com/pressly/goose/v3"
)

// moduleRouter registers feature-module routes behind the same auth, admin and
// feature-flag middleware as core's own routes. The module's handler gets the
// caller's identity.Claims and can add fields, such as its admin audit action,
// to core's log lines for the request.
type moduleRouter struct{ srv *Server }

func (mr moduleRouter) Handle(rt module.Route) {
	h := func(w http.ResponseWriter, r *http.Request, log sLog) error {
		claims := r.Context().Value(ClaimsKey).(*Claims)
		ctx := identity.NewContext(r.Context(), claims.identityClaims())
		ctx = module.WithLog(ctx, log.add)
		rt.Handler.ServeHTTP(w, r.WithContext(ctx))
		return nil
	}
	def := routeDef{routeMethod: rt.Pattern, handler: h, features: rt.Features}
	switch rt.Access {
	case module.AnyUser:
	case module.Admin:
		def.admin = true
	case module.DeptAdmin:
		def.admin = true
		def.resolver = DeptAdminResolver
	case module.SystemAdmin:
		def.admin = true
		def.resolver = SystemAdminResolver
	default:
		// Registration runs once at startup, so an unknown level stops the
		// server instead of leaving a route open.
		panic(fmt.Sprintf("module route %q: unknown access level %d", rt.Pattern, rt.Access))
	}
	mr.srv.register(func() []routeDef { return []routeDef{def} })
}

// identityClaims is what a module sees of the caller: core's claims without
// the Kratos and password-reset details.
func (c *Claims) identityClaims() *identity.Claims {
	return &identity.Claims{
		UserID:        c.UserID,
		Username:      c.Username,
		Role:          c.Role,
		FacilityID:    c.FacilityID,
		FacilityName:  c.FacilityName,
		FeatureAccess: c.FeatureAccess,
		SessionID:     c.SessionID,
		TimeZone:      c.TimeZone,
	}
}

// wsNotifier sends module messages over the websocket. It reads srv.wsClient
// on each call because the server creates the websocket after registering
// routes, and the testing server has none.
type wsNotifier struct{ srv *Server }

func (n wsNotifier) Notify(userID uint, msg module.Message) {
	if n.srv.wsClient == nil {
		return
	}
	n.srv.wsClient.notifyUser(WsMsg{
		EventType: WsEventType(msg.Event),
		UserID:    userID,
		Msg:       MsgContent{ActivityID: msg.ActivityID, Msg: msg.Text},
	})
}

func (srv *Server) moduleDeps() module.Deps {
	return module.Deps{DB: srv.Db.DB, NATS: srv.nats, Notify: wsNotifier{srv}}
}

func (srv *Server) registerModuleRoutes() {
	for _, m := range srv.modules {
		m.Register(moduleRouter{srv}, srv.moduleDeps())
	}
}

// migrateModules runs the feature modules' migrations. InitDB has already run
// core's, so modules always migrate after core.
func (srv *Server) migrateModules(ctx context.Context) error {
	db, err := srv.Db.DB.DB()
	if err != nil {
		return fmt.Errorf("get database connection: %w", err)
	}
	return module.Migrate(ctx, db, goose.DialectPostgres, srv.modules)
}
