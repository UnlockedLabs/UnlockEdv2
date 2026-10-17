package handlers

import (
	"fmt"
	"net/http"

	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"
)

// moduleRouter registers feature-module routes behind the same auth, admin and
// feature-flag middleware as core's own routes.
type moduleRouter struct{ srv *Server }

func (mr moduleRouter) Handle(rt module.Route) {
	h := func(w http.ResponseWriter, r *http.Request, _ sLog) error {
		rt.Handler.ServeHTTP(w, r)
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

func (srv *Server) moduleDeps() module.Deps {
	return module.Deps{DB: srv.Db.DB, NATS: srv.nats}
}

func (srv *Server) registerModuleRoutes() {
	for _, m := range srv.modules {
		m.Register(moduleRouter{srv}, srv.moduleDeps())
	}
}

func (srv *Server) registerModuleJobs() {
	for _, m := range srv.modules {
		m.RegisterJobs(srv.scheduler, srv.moduleDeps())
	}
}
