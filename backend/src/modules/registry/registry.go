// Package registry is the one list of feature modules. The server and the
// migrations CLI both use it, so adding a module means adding it here only.
// It also hands core each module's api, so core never imports a module's
// insides.
package registry

import (
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/learningrecord"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/module"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/opencontent"
	ocapi "github.com/UnlockedLabs/unlocked-core/backend/src/modules/opencontent/api"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/programs"
	"github.com/UnlockedLabs/unlocked-core/backend/src/modules/providerplatforms"
	ppapi "github.com/UnlockedLabs/unlocked-core/backend/src/modules/providerplatforms/api"

	"gorm.io/gorm"
)

// All returns every feature module, in the order their routes and jobs are
// registered and their migrations run. Provider Platforms comes before
// Programs, because Programs uses its classes (EN-186).
func All() []module.Module {
	return []module.Module{
		providerplatforms.Module{},
		opencontent.Module{},
		programs.Module{},
		learningrecord.Module{},
	}
}

// OpenContent is Open Content's answers to core, reading db.
func OpenContent(db *gorm.DB) ocapi.OpenContent {
	return opencontent.NewAPI(db)
}

// ProviderPlatforms is Provider Platforms' answers to core, reading db.
func ProviderPlatforms(db *gorm.DB) ppapi.ProviderPlatforms {
	return providerplatforms.NewAPI(db)
}
